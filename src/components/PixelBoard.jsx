import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { usePixels } from '../hooks/usePixels';
import { useAuth } from '../hooks/useAuth';
import AuthModal from './AuthModal';
import PurchaseModal from './PurchaseModal';
import MiniMapCanvas from './MiniMapCanvas';
import BrandSearch from './BrandSearch';
import HeatmapOverlay from './HeatmapOverlay';
import Button from './ui/Button';
import Input from './ui/Input';
import { apiClient } from '../api/client';
import usePixelViewport from '../store/usePixelViewport';
import * as ImageCache from '../utils/imageCache';
import {
    BOARD_WIDTH, BOARD_HEIGHT,
    GRID_LEVELS, GRID_OVERLAY_COLOR, GRID_OVERLAY_MIN_CELL,
    HOVER_GLOW_COLOR, HOVER_BORDER_COLOR,
    SELECTION_COLOR, SELECTION_BORDER_COLOR,
    DRAG_BG_COLOR,
    MIN_ZOOM, MAX_ZOOM
} from '../constants/canvasConfig';

// Keep legacy alias
const BOARD_SIZE = BOARD_WIDTH;
const VIEWPORT_FETCH_DEBOUNCE_MS = 500;
const VIEWPORT_MOVE_THRESHOLD = 20;

function getDomain(url) {
    if (!url) return '';
    try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        return u.hostname.replace("www.", "");
    } catch {
        return url;
    }
}

export default function PixelBoard() {
    const queryClient = useQueryClient();
    const canvasRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const containerRef = useRef(null);

    // --- Camera state ---
    // camera.x, camera.y = top-left corner of visible board area (in board coords)
    // camera.zoom = how many screen pixels per board cell
    const camera = useRef({ x: 0, y: 0, zoom: 1 });
    const [zoomDisplay, setZoomDisplay] = useState(1);

    // Pan state
    const isPanning = useRef(false);
    const panStart = useRef({ x: 0, y: 0 });
    const panCameraStart = useRef({ x: 0, y: 0 });
    const spaceHeld = useRef(false);

    // Zoom easing
    const targetZoom = useRef(1);
    const zoomAnimFrame = useRef(null);
    const zoomFocusBoard = useRef(null); // board coord to keep stationary during zoom

    const [tooltippos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [cursorNearMinimap, setCursorNearMinimap] = useState(false);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [hoveredPixel, setHoveredPixel] = useState(null);
    const [selectedPixels, setSelectedPixels] = useState(new Set());
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
    const [purchaseError, setPurchaseError] = useState('');
    const [purchaseKey, setPurchaseKey] = useState(0);

    const [quantityInput, setQuantityInput] = useState('');
    const [widthInput, setWidthInput] = useState('');
    const [heightInput, setHeightInput] = useState('');

    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState(null);
    const [dragEnd, setDragEnd] = useState(null);
    const isDraggingRef = useRef(false);
    const currentDragStart = useRef(null);
    const currentDragEnd = useRef(null);

    const { purchase } = usePixels();
    const { blocks, brands, loading: isLoading, setViewport, refresh } = usePixelViewport();
    const { user } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });

    // Heatmap toggle
    const [heatmapVisible, setHeatmapVisible] = useState(false);
    const viewportFetchTimerRef = useRef(null);
    const lastFetchedViewportRef = useRef('');
    const lastCameraRef = useRef({ x: NaN, y: NaN, zoom: NaN });
    const lastFetchCameraRef = useRef({ x: NaN, y: NaN, zoom: NaN });
    const lastFetchedBoundsRef = useRef(null);

    // Purchase highlight animation
    const purchaseHighlight = useRef(null); // { bounds: {minX,minY,maxX,maxY}, startTime }

    // Fast lookup
    const brandSummaryMap = useMemo(() => {
        return new Map((brands || []).map((brand) => [brand.brandId, brand]));
    }, [brands]);

    const ownedPixels = useMemo(() => {
        if (!Array.isArray(blocks) || blocks.length === 0) return [];

        const expanded = [];
        for (const block of blocks) {
            const summary = brandSummaryMap.get(block.brandId);
            const ownerName = summary?.brandName || block.brandId || 'Anonymous';
            const blockArea = block.width * block.height;

            for (let y = block.yStart; y < block.yStart + block.height; y++) {
                for (let x = block.xStart; x < block.xStart + block.width; x++) {
                    expanded.push({
                        id: `${block.id}:${x}:${y}`,
                        x,
                        y,
                        color: '#0a0a0a',
                        ownerId: block.ownerId,
                        purchaseId: block.id,
                        brandId: block.brandId,
                        ownerName,
                        ownerLogo: summary?.logoUrl || null,
                        logoUrl: summary?.logoUrl || null,
                        ownerUrl: summary?.url || null,
                        fitMode: summary?.fitMode || 'cover',
                        imageWidth: summary?.imageWidth || null,
                        imageHeight: summary?.imageHeight || null,
                        ownerPixelCount: summary?.totalPixels || blockArea,
                        ownerRank: summary?.rank || '-',
                        blockArea,
                    });
                }
            }
        }

        return expanded;
    }, [blocks, brandSummaryMap]);

    const ownedMap = useMemo(() => {
        const map = new Map();
        if (ownedPixels) {
            ownedPixels.forEach(p => map.set(`${p.x},${p.y}`, p));
        }
        return map;
    }, [ownedPixels]);

    const getPixelState = useCallback((x, y) => {
        const key = `${x},${y}`;
        if (ownedMap.has(key)) return 'OWNED';
        if (selectedPixels.has(key)) return 'SELECTED';
        return 'AVAILABLE';
    }, [ownedMap, selectedPixels]);

    // Precompute per-purchase geometry once per pixels payload update.
    const precomputedBlocks = useMemo(() => {
        const groups = new Map();

        (ownedPixels || []).forEach((p) => {
            const groupId = p.purchaseId || p.ownerId;
            const existing = groups.get(groupId);

            if (!existing) {
                groups.set(groupId, {
                    groupId,
                    color: p.color,
                    ownerLogo: p.ownerLogo,
                    logoUrl: p.logoUrl,
                    fitMode: p.fitMode,
                    imageWidth: p.imageWidth,
                    imageHeight: p.imageHeight,
                    minX: p.x,
                    maxX: p.x,
                    minY: p.y,
                    maxY: p.y,
                });
                return;
            }

            if (p.x < existing.minX) existing.minX = p.x;
            if (p.x > existing.maxX) existing.maxX = p.x;
            if (p.y < existing.minY) existing.minY = p.y;
            if (p.y > existing.maxY) existing.maxY = p.y;
        });

        return Array.from(groups.values());
    }, [ownedPixels]);

    const redrawFrame = useRef(null);
    const requestRedrawRef = useRef(() => { });
    const hoveredKeyRef = useRef('');
    const lastCursorPosRef = useRef({ x: 0, y: 0 });
    const lastTooltipPosRef = useRef({ x: 0, y: 0 });
    const lastNearMinimapRef = useRef(false);

    // Mobile gesture state
    const touchState = useRef({
        type: 'none',       // 'none' | 'waiting' | 'select' | 'pan' | 'pinch'
        startTouches: null,  // initial touch(es) snapshot
        startCamera: null,   // camera at gesture start
        startDist: 0,        // initial pinch distance
        startZoom: 0,        // zoom at pinch start
        startMidBoard: null, // board-space midpoint at pinch start
        waitTimer: null,     // 80ms timer to disambiguate tap vs pan
    });

    const resolveLogoUrl = useCallback((logoPath) => {
        if (!logoPath) return '';
        if (/^(blob:|data:)/i.test(logoPath)) return logoPath;

        const baseURL = apiClient.defaults.baseURL || window.location.origin;
        const r2PublicBase =
            import.meta.env.VITE_R2_PUBLIC_BASE_URL
            || import.meta.env.VITE_R2_PUBLIC_URL
            || import.meta.env.VITE_LOGO_CDN_BASE_URL
            || '';

        const normalizedR2Base = r2PublicBase ? r2PublicBase.replace(/\/+$/, '') : '';
        const normalizedPathInput = String(logoPath).trim();

        if (/^https?:\/\//i.test(normalizedPathInput)) {
            try {
                const incoming = new URL(normalizedPathInput);
                const incomingHost = incoming.hostname.toLowerCase();
                const isLocalHost = incomingHost === 'localhost' || incomingHost === '127.0.0.1' || incomingHost === '::1';

                if (!isLocalHost) return normalizedPathInput;

                const apiBase = new URL(baseURL);
                return new URL(`${incoming.pathname}${incoming.search}${incoming.hash}`, apiBase).toString();
            } catch {
                return normalizedPathInput;
            }
        }

        if (normalizedR2Base && !normalizedPathInput.startsWith('/uploads/') && !normalizedPathInput.startsWith('uploads/')) {
            const cleanedPath = normalizedPathInput.replace(/^\/+/, '');
            return `${normalizedR2Base}/${cleanedPath}`;
        }

        const normalizedPath = normalizedPathInput.startsWith('/uploads/')
            ? normalizedPathInput
            : normalizedPathInput.startsWith('uploads/')
                ? `/${normalizedPathInput}`
                : `/uploads/${normalizedPathInput.split('/').pop()}`;

        return new URL(normalizedPath, baseURL).toString();
    }, []);

    const drawLogoWithFit = useCallback((ctx, img, fitMode, imageWidth, imageHeight, x, y, w, h) => {
        const safeFit = (fitMode || 'cover').toLowerCase();
        const srcW = imageWidth || img.naturalWidth || img.width;
        const srcH = imageHeight || img.naturalHeight || img.height;

        if (!srcW || !srcH || w <= 0 || h <= 0) return;

        if (safeFit === 'fill') {
            ctx.drawImage(img, x, y, w, h);
            return;
        }

        if (safeFit === 'contain') {
            const scale = Math.min(w / srcW, h / srcH);
            const dw = srcW * scale;
            const dh = srcH * scale;
            const dx = x + (w - dw) / 2;
            const dy = y + (h - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
            return;
        }

        const scale = Math.max(w / srcW, h / srcH);
        const cropW = w / scale;
        const cropH = h / scale;
        const sx = (srcW - cropW) / 2;
        const sy = (srcH - cropH) / 2;
        ctx.drawImage(img, sx, sy, cropW, cropH, x, y, w, h);
    }, []);


    // --- Coordinate transforms ---
    const boardToScreen = useCallback((bx, by) => {
        const c = camera.current;
        return {
            x: (bx - c.x) * c.zoom,
            y: (by - c.y) * c.zoom
        };
    }, []);

    const screenToBoard = useCallback((sx, sy) => {
        const c = camera.current;
        return {
            x: sx / c.zoom + c.x,
            y: sy / c.zoom + c.y
        };
    }, []);

    const getViewportBounds = useCallback(() => {
        const c = camera.current;
        const { w, h } = canvasSize;
        if (!w || !h || !c.zoom) return null;

        const minX = Math.max(0, Math.floor(c.x));
        const minY = Math.max(0, Math.floor(c.y));
        const maxX = Math.min(BOARD_WIDTH - 1, Math.ceil(c.x + w / c.zoom));
        const maxY = Math.min(BOARD_HEIGHT - 1, Math.ceil(c.y + h / c.zoom));

        if (maxX < minX || maxY < minY) return null;
        return { minX, minY, maxX, maxY };
    }, [canvasSize]);

    const queueViewportFetch = useCallback((immediate = false) => {
        const bounds = getViewportBounds();
        if (!bounds) return;

        const currentCamera = camera.current;
        const lastFetchCamera = lastFetchCameraRef.current;

        if (!immediate) {
            const movedTooLittle =
                Math.abs(currentCamera.x - lastFetchCamera.x) < VIEWPORT_MOVE_THRESHOLD
                && Math.abs(currentCamera.y - lastFetchCamera.y) < VIEWPORT_MOVE_THRESHOLD
                && Math.abs(currentCamera.zoom - lastFetchCamera.zoom) < 0.01;

            if (movedTooLittle) return;
        }

        const lastBounds = lastFetchedBoundsRef.current;
        if (!immediate && lastBounds) {
            const changedEnough =
                Math.abs(bounds.minX - lastBounds.minX) >= VIEWPORT_MOVE_THRESHOLD
                || Math.abs(bounds.maxX - lastBounds.maxX) >= VIEWPORT_MOVE_THRESHOLD
                || Math.abs(bounds.minY - lastBounds.minY) >= VIEWPORT_MOVE_THRESHOLD
                || Math.abs(bounds.maxY - lastBounds.maxY) >= VIEWPORT_MOVE_THRESHOLD;

            if (!changedEnough) return;
        }

        const key = `${bounds.minX}:${bounds.minY}:${bounds.maxX}:${bounds.maxY}`;
        if (!immediate && lastFetchedViewportRef.current === key) return;

        const run = async () => {
            // Mark immediately to avoid mount-time duplicate fetches while request is in flight.
            lastFetchedViewportRef.current = key;
            lastFetchedBoundsRef.current = bounds;
            lastFetchCameraRef.current = { x: currentCamera.x, y: currentCamera.y, zoom: currentCamera.zoom };
            setViewport(bounds);
        };

        if (viewportFetchTimerRef.current) {
            clearTimeout(viewportFetchTimerRef.current);
            viewportFetchTimerRef.current = null;
        }

        if (immediate) {
            void run();
            return;
        }

        viewportFetchTimerRef.current = setTimeout(() => {
            viewportFetchTimerRef.current = null;
            void run();
        }, VIEWPORT_FETCH_DEBOUNCE_MS);
    }, [setViewport, getViewportBounds]);

    // --- Clamp camera to keep board visible ---
    // Extra margin on right/bottom so users can pan board out from under the mini-map
    const MINIMAP_SAFE_PX = 180; // slightly larger than mini-map (160 + spacing)
    const clampCamera = useCallback(() => {
        const c = camera.current;
        const { w, h } = canvasSize;
        const viewW = w / c.zoom;
        const viewH = h / c.zoom;

        // Convert mini-map screen px to board cells at current zoom
        const safeBoard = MINIMAP_SAFE_PX / c.zoom;

        const margin = 0.1;
        const minX = -viewW * margin;
        const minY = -viewH * margin;
        const maxX = BOARD_WIDTH - viewW * (1 - margin) + safeBoard;
        const maxY = BOARD_HEIGHT - viewH * (1 - margin) + safeBoard;

        c.x = Math.max(minX, Math.min(maxX, c.x));
        c.y = Math.max(minY, Math.min(maxY, c.y));
    }, [canvasSize]);

    // --- Fit entire board in view ---
    const fitToViewport = useCallback(() => {
        const { w, h } = canvasSize;
        if (w === 0 || h === 0) return;

        // Add 5% padding so the board doesn't touch the container edges
        const padding = 0.90; // use 90% of available space
        const fitZoom = Math.min(w / BOARD_WIDTH, h / BOARD_HEIGHT) * padding;

        // Center: set camera.x/y so the board is in the middle of the viewport
        // The viewport shows [camera.x .. camera.x + w/zoom] in board coords
        // To center: camera.x + (w/zoom)/2 = BOARD_WIDTH/2
        camera.current.zoom = fitZoom;
        camera.current.x = BOARD_WIDTH / 2 - (w / fitZoom) / 2;
        camera.current.y = BOARD_HEIGHT / 2 - (h / fitZoom) / 2;
        targetZoom.current = fitZoom;
        setZoomDisplay(fitZoom);
    }, [canvasSize]);

    // --- Resize observer ---
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setCanvasSize({ w: Math.floor(width), h: Math.floor(height) });
            }
        });
        ro.observe(container);
        return () => ro.disconnect();
    }, []);

    // Fit on first meaningful size
    const hasInitialized = useRef(false);
    useEffect(() => {
        if (canvasSize.w > 100 && canvasSize.h > 100 && !hasInitialized.current) {
            hasInitialized.current = true;
            fitToViewport();
        }
    }, [canvasSize, fitToViewport, queueViewportFetch]);


    // --- Draw base board (grid + owned pixels + logos) ---
    const drawBaseBoard = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const { w, h } = canvasSize;

        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.scale(dpr, dpr);
        }

            const c = camera.current;
            const cellScreen = c.zoom; // pixels per cell on screen

            ctx.clearRect(0, 0, w, h);

            // Draw board background (white rectangle)
            const boardTopLeft = boardToScreen(0, 0);
            const boardBottomRight = boardToScreen(BOARD_WIDTH, BOARD_HEIGHT);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(boardTopLeft.x, boardTopLeft.y, boardBottomRight.x - boardTopLeft.x, boardBottomRight.y - boardTopLeft.y);

            // Visible range in board coords
            const startCol = Math.max(0, Math.floor(c.x));
            const startRow = Math.max(0, Math.floor(c.y));
            const endCol = Math.min(BOARD_WIDTH, Math.ceil(c.x + w / c.zoom));
            const endRow = Math.min(BOARD_HEIGHT, Math.ceil(c.y + h / c.zoom));

            // 1. Visible block filtering from precomputed geometry
            const visibleBlocks = precomputedBlocks.filter((block) => {
                if (block.maxX < startCol - 50) return false;
                if (block.minX > endCol + 50) return false;
                if (block.maxY < startRow - 50) return false;
                if (block.minY > endRow + 50) return false;
                return true;
            });

            const visibleDrawBlocks = visibleBlocks.map((block) => {
                const tl = boardToScreen(block.minX, block.minY);
                const br = boardToScreen(block.maxX + 1, block.maxY + 1);
                return {
                    block,
                    tl,
                    br,
                    drawW: br.x - tl.x,
                    drawH: br.y - tl.y,
                };
            });

            // 2. Draw block backgrounds (batched by color to minimize fillStyle changes)
            const colorGroups = new Map();
            visibleDrawBlocks.forEach((vdb) => {
                const c = vdb.block.color || '#000000';
                let arr = colorGroups.get(c);
                if (!arr) { arr = []; colorGroups.set(c, arr); }
                arr.push(vdb);
            });
            for (const [color, blocks] of colorGroups) {
                ctx.fillStyle = color;
                for (let i = 0; i < blocks.length; i++) {
                    const { tl, br } = blocks[i];
                    ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
                }
            }

            // 3. Dynamic multi-level grid
            const bTop = Math.max(0, boardTopLeft.y);
            const bBot = Math.min(h, boardBottomRight.y);
            const bLeft = Math.max(0, boardTopLeft.x);
            const bRight = Math.min(w, boardBottomRight.x);

            for (const level of GRID_LEVELS) {
                const screenStep = level.step * cellScreen;
                if (screenStep < level.minCellScreen) continue; // too dense at this zoom

                ctx.strokeStyle = level.color;
                ctx.lineWidth = level.lineWidth;
                ctx.beginPath();

                const colStart = Math.ceil(startCol / level.step) * level.step;
                const colEnd = Math.floor(endCol / level.step) * level.step;
                const colLines = Math.max(0, Math.floor((colEnd - colStart) / level.step) + 1);
                const rowStart = Math.ceil(startRow / level.step) * level.step;
                const rowEnd = Math.floor(endRow / level.step) * level.step;
                const rowLines = Math.max(0, Math.floor((rowEnd - rowStart) / level.step) + 1);

                // Skip overly dense grids even if technically visible at this zoom.
                const totalLines = colLines + rowLines;
                if (totalLines > 1200) continue;

                for (let col = colStart; col <= colEnd; col += level.step) {
                    const sx = (col - c.x) * c.zoom;
                    ctx.moveTo(Math.round(sx), bTop);
                    ctx.lineTo(Math.round(sx), bBot);
                }

                for (let row = rowStart; row <= rowEnd; row += level.step) {
                    const sy = (row - c.y) * c.zoom;
                    ctx.moveTo(bLeft, Math.round(sy));
                    ctx.lineTo(bRight, Math.round(sy));
                }
                ctx.stroke();
            }

            // 4. Draw logos — uses shared ImageCache module with atlas support
            ctx.imageSmoothingEnabled = false;
            const atlasCanvas = ImageCache.getAtlasCanvas();
            visibleDrawBlocks.forEach(({ block, tl, br, drawW, drawH }) => {
                const logoToUse = block.ownerLogo || block.logoUrl;
                if (!logoToUse) return;
                const resolvedLogoUrl = resolveLogoUrl(logoToUse);
                if (!resolvedLogoUrl) return;

                // Skip if too small to see
                if (drawW < 2 || drawH < 2) return;

                const entry = ImageCache.load(resolvedLogoUrl);

                if (entry && entry.status === 'ready') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(tl.x, tl.y, drawW, drawH);

                    // Prefer atlas draw (single GPU texture) when slot is available
                    if (entry.atlasRect && atlasCanvas) {
                        const r = entry.atlasRect;
                        ctx.drawImage(atlasCanvas, r.x, r.y, r.w, r.h, tl.x, tl.y, drawW, drawH);
                    } else if (entry.img) {
                        drawLogoWithFit(
                            ctx,
                            entry.img,
                            block.fitMode,
                            block.imageWidth,
                            block.imageHeight,
                            tl.x,
                            tl.y,
                            drawW,
                            drawH
                        );
                    }
                } else if (drawW > 20 && drawH > 12) {
                    // Show loading/error placeholder with brand initial
                    const isError = entry && entry.status === 'error';
                    ctx.fillStyle = isError ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.7)';
                    ctx.fillRect(tl.x, tl.y, drawW, drawH);

                    // Draw brand initial letter
                    const brandName = block.groupId ? String(block.groupId).charAt(0).toUpperCase() : '?';
                    const fontSize = Math.max(8, Math.min(drawW * 0.4, drawH * 0.5, 32));
                    ctx.fillStyle = isError ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.1)';
                    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(brandName, tl.x + drawW / 2, tl.y + drawH / 2);

                    // Subtle loading spinner indicator (not error)
                    if (!isError && drawW > 30) {
                        const spinnerR = Math.min(6, drawW * 0.08);
                        const cx = tl.x + drawW - spinnerR - 4;
                        const cy = tl.y + spinnerR + 4;
                        const angle = (performance.now() / 600) % (Math.PI * 2);
                        ctx.beginPath();
                        ctx.arc(cx, cy, spinnerR, angle, angle + Math.PI * 1.4);
                        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                }
            });

            // 5. Faint overlay grid OVER logos (only at close zoom)
            if (cellScreen >= GRID_OVERLAY_MIN_CELL) {
                ctx.strokeStyle = GRID_OVERLAY_COLOR;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                for (let col = startCol; col <= endCol; col++) {
                    const sx = (col - c.x) * c.zoom;
                    ctx.moveTo(Math.round(sx), bTop);
                    ctx.lineTo(Math.round(sx), bBot);
                }
                for (let row = startRow; row <= endRow; row++) {
                    const sy = (row - c.y) * c.zoom;
                    ctx.moveTo(bLeft, Math.round(sy));
                    ctx.lineTo(bRight, Math.round(sy));
                }
                ctx.stroke();
            }

            // 6. Draw board border
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(boardTopLeft.x, boardTopLeft.y, boardBottomRight.x - boardTopLeft.x, boardBottomRight.y - boardTopLeft.y);
    }, [precomputedBlocks, canvasSize, boardToScreen, drawLogoWithFit, resolveLogoUrl]);

    // --- Draw overlay (hover, selection, drag preview) ---
    const drawOverlayBoard = useCallback(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const { w, h } = canvasSize;

        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.scale(dpr, dpr);
        }

            ctx.clearRect(0, 0, w, h);
            const c = camera.current;

            // Hover glow
            if (hoveredPixel && !isDragging) {
                const tl = boardToScreen(hoveredPixel.x, hoveredPixel.y);
                const br = boardToScreen(hoveredPixel.x + 1, hoveredPixel.y + 1);
                ctx.save();
                ctx.shadowBlur = 15;
                ctx.shadowColor = HOVER_GLOW_COLOR;
                ctx.strokeStyle = HOVER_BORDER_COLOR;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.lineDashOffset = -(performance.now() / 50);
                ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
                ctx.restore();
            }

            // Selected pixels (bounding rect)
            if (selectedPixels.size > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                selectedPixels.forEach(key => {
                    const [x, y] = key.split(',').map(Number);
                    if (x < minX) minX = x; if (y < minY) minY = y;
                    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
                });
                const tl = boardToScreen(minX, minY);
                const br = boardToScreen(maxX + 1, maxY + 1);

                ctx.fillStyle = SELECTION_COLOR;
                ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
                ctx.strokeStyle = SELECTION_BORDER_COLOR;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.lineDashOffset = -(performance.now() / 50);
                ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
                ctx.setLineDash([]);
            }

            // Drag preview
            if (isDragging && currentDragStart.current && currentDragEnd.current) {
                const minX = Math.min(currentDragStart.current.x, currentDragEnd.current.x);
                const maxX = Math.max(currentDragStart.current.x, currentDragEnd.current.x);
                const minY = Math.min(currentDragStart.current.y, currentDragEnd.current.y);
                const maxY = Math.max(currentDragStart.current.y, currentDragEnd.current.y);

                const tl = boardToScreen(minX, minY);
                const br = boardToScreen(maxX + 1, maxY + 1);

                ctx.fillStyle = DRAG_BG_COLOR;
                ctx.strokeStyle = SELECTION_BORDER_COLOR;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.lineDashOffset = -(performance.now() / 50);
                ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
                ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
                ctx.setLineDash([]);

                // Highlight owned cells within drag bounds as non-selectable (red)
                const dragW = maxX - minX + 1;
                const dragH = maxY - minY + 1;
                if (dragW * dragH <= 40000) {
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
                    for (let dx = minX; dx <= maxX; dx++) {
                        for (let dy = minY; dy <= maxY; dy++) {
                            if (ownedMap.has(`${dx},${dy}`)) {
                                ctx.fillRect(
                                    (dx - c.x) * c.zoom,
                                    (dy - c.y) * c.zoom,
                                    c.zoom,
                                    c.zoom
                                );
                            }
                        }
                    }
                }
            }

            // Purchase highlight animation (Feature 11)
            if (purchaseHighlight.current) {
                const { bounds, startTime } = purchaseHighlight.current;
                const elapsed = performance.now() - startTime;
                const duration = 1800;
                if (elapsed < duration) {
                    const progress = elapsed / duration;
                    const alpha = Math.max(0, 0.45 * (1 - progress));
                    const pulseScale = 1 + Math.sin(progress * Math.PI * 3) * 0.02;
                    const tl = boardToScreen(bounds.minX, bounds.minY);
                    const br = boardToScreen(bounds.maxX + 1, bounds.maxY + 1);
                    const pw = br.x - tl.x;
                    const ph = br.y - tl.y;
                    const cx = tl.x + pw / 2;
                    const cy = tl.y + ph / 2;
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.scale(pulseScale, pulseScale);
                    ctx.translate(-cx, -cy);
                    ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
                    ctx.fillRect(tl.x, tl.y, pw, ph);
                    ctx.strokeStyle = `rgba(34, 197, 94, ${alpha + 0.2})`;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(tl.x, tl.y, pw, ph);
                    ctx.restore();
                } else {
                    purchaseHighlight.current = null;
                }
            }

            // Keep animating for marching ants
            if (selectedPixels.size > 0 || isDragging || hoveredPixel || purchaseHighlight.current) {
                requestRedrawRef.current();
            }
    }, [selectedPixels, hoveredPixel, isDragging, canvasSize, boardToScreen, ownedMap]);

    // --- Single frame scheduler for all board redraw requests ---
    const scheduleRedraw = useCallback(() => {
        if (redrawFrame.current) return;
        redrawFrame.current = requestAnimationFrame(() => {
            const c = camera.current;
            const moved =
                c.x !== lastCameraRef.current.x
                || c.y !== lastCameraRef.current.y
                || c.zoom !== lastCameraRef.current.zoom;

            if (moved) {
                lastCameraRef.current = { x: c.x, y: c.y, zoom: c.zoom };
                queueViewportFetch(false);
            }

            redrawFrame.current = null;
            drawBaseBoard();
            drawOverlayBoard();
        });
    }, [drawBaseBoard, drawOverlayBoard, queueViewportFetch]);

    useEffect(() => {
        requestRedrawRef.current = scheduleRedraw;
    }, [scheduleRedraw]);

    // Wire the ImageCache module's redraw callback to our scheduler
    useEffect(() => {
        ImageCache.setRedrawCallback(scheduleRedraw);
        return () => ImageCache.setRedrawCallback(null);
    }, [scheduleRedraw]);

    // Preload visible logos whenever pixel data or camera changes
    useEffect(() => {
        if (!precomputedBlocks || precomputedBlocks.length === 0) return;
        const urls = [];
        for (let i = 0; i < precomputedBlocks.length; i++) {
            const block = precomputedBlocks[i];
            const logo = block.ownerLogo || block.logoUrl;
            if (!logo) continue;
            const resolved = resolveLogoUrl(logo);
            if (resolved) urls.push(resolved);
        }
        if (urls.length > 0) ImageCache.preloadBatch(urls);
    }, [precomputedBlocks, resolveLogoUrl]);

    // Re-render on data or interactive overlay changes
    useEffect(() => {
        scheduleRedraw();
    }, [scheduleRedraw, isDragging, dragStart, dragEnd, hoveredPixel]);

    // --- Mini-map navigation callback ---
    const onMiniMapNavigate = useCallback((boardX, boardY) => {
        const c = camera.current;
        const { w, h } = canvasSize;
        c.x = boardX - (w / c.zoom) / 2;
        c.y = boardY - (h / c.zoom) / 2;
        clampCamera();
        setZoomDisplay(z => z);
        scheduleRedraw();
    }, [canvasSize, clampCamera, scheduleRedraw]);

    // --- Zoom-to-brand navigation (Feature 5) ---
    const panToBrand = useCallback((brandName) => {
        if (!ownedPixels || !brandName) return;
        const brandPixels = ownedPixels.filter(p =>
            (p.brandName || '').toLowerCase() === brandName.toLowerCase()
        );
        if (brandPixels.length === 0) return;

        const xs = brandPixels.map(p => p.x);
        const ys = brandPixels.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const bw = maxX - minX + 1;
        const bh = maxY - minY + 1;
        const centerX = minX + bw / 2;
        const centerY = minY + bh / 2;

        // Zoom to fit the brand region with padding
        const { w, h } = canvasSize;
        const padding = 2.5;
        const newZoom = Math.min(MAX_ZOOM, Math.min(w / (bw * padding), h / (bh * padding)));

        // Animate smoothly
        const c = camera.current;
        const startX = c.x, startY = c.y, startZoom = c.zoom;
        const endX = centerX - (w / newZoom) / 2;
        const endY = centerY - (h / newZoom) / 2;
        const startTime = performance.now();
        const duration = 600;

        const animatePan = () => {
            const elapsed = performance.now() - startTime;
            const t = Math.min(1, elapsed / duration);
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

            c.x = startX + (endX - startX) * ease;
            c.y = startY + (endY - startY) * ease;
            c.zoom = startZoom + (newZoom - startZoom) * ease;
            targetZoom.current = c.zoom;

            clampCamera();
            setZoomDisplay(Math.round(c.zoom * 100));
            scheduleRedraw();

            if (t < 1) requestAnimationFrame(animatePan);
        };
        requestAnimationFrame(animatePan);
    }, [ownedPixels, canvasSize, clampCamera, scheduleRedraw]);

    // --- Zoom animation ---
    const animateZoom = useCallback(() => {
        const c = camera.current;
        const diff = targetZoom.current - c.zoom;
        if (Math.abs(diff) < 0.01) {
            // Snap
            if (zoomFocusBoard.current) {
                const focus = zoomFocusBoard.current;
                const screenFocus = focus.screenX;
                const screenFocusY = focus.screenY;
                c.x = focus.boardX - screenFocus / targetZoom.current;
                c.y = focus.boardY - screenFocusY / targetZoom.current;
            }
            c.zoom = targetZoom.current;
            clampCamera();
            setZoomDisplay(c.zoom);
            scheduleRedraw();
            return;
        }
        const newZoom = c.zoom + diff * 0.15;

        // Zoom toward focus point
        if (zoomFocusBoard.current) {
            const focus = zoomFocusBoard.current;
            c.x = focus.boardX - focus.screenX / newZoom;
            c.y = focus.boardY - focus.screenY / newZoom;
        }
        c.zoom = newZoom;
        clampCamera();
        setZoomDisplay(newZoom);
        scheduleRedraw();
        zoomAnimFrame.current = requestAnimationFrame(animateZoom);
    }, [clampCamera, scheduleRedraw]);

    const zoomToward = useCallback((newTarget, screenX, screenY) => {
        const c = camera.current;
        const clamped = Math.max(MIN_ZOOM, Math.min(newTarget, MAX_ZOOM));
        targetZoom.current = clamped;

        // Calculate the board point under the cursor
        const boardX = screenX / c.zoom + c.x;
        const boardY = screenY / c.zoom + c.y;
        zoomFocusBoard.current = { boardX, boardY, screenX, screenY };

        if (zoomAnimFrame.current) cancelAnimationFrame(zoomAnimFrame.current);
        zoomAnimFrame.current = requestAnimationFrame(animateZoom);
    }, [animateZoom]);

    const updateTargetZoom = useCallback((newTarget) => {
        // Zoom from center of viewport
        const { w, h } = canvasSize;
        zoomToward(newTarget, w / 2, h / 2);
    }, [canvasSize, zoomToward]);

    // Cleanup animation frames
    useEffect(() => {
        return () => {
            if (zoomAnimFrame.current) cancelAnimationFrame(zoomAnimFrame.current);
            if (redrawFrame.current) cancelAnimationFrame(redrawFrame.current);
            if (viewportFetchTimerRef.current) clearTimeout(viewportFetchTimerRef.current);
        };
    }, []);

    // --- Wheel zoom (with trackpad pinch-to-zoom support) ---
    useEffect(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;

        const handleWheel = (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;

            if (e.ctrlKey || e.metaKey) {
                // Trackpad pinch or Ctrl+scroll → ZOOM
                const zoomDelta = -e.deltaY * 0.01;
                const newZ = camera.current.zoom * (1 + zoomDelta);
                zoomToward(newZ, sx, sy);
            } else {
                // Two-finger trackpad scroll or mouse wheel → PAN
                // deltaX → horizontal pan, deltaY → vertical pan
                const c = camera.current;
                c.x += e.deltaX / c.zoom;
                c.y += e.deltaY / c.zoom;
                clampCamera();
                scheduleRedraw();
            }
        };

        canvas.addEventListener('wheel', handleWheel, { passive: false });

        // Safari gesture events for trackpad pinch (Safari doesn't set ctrlKey on wheel)
        const handleGestureStart = (e) => e.preventDefault();
        const handleGestureChange = (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const newZ = camera.current.zoom * e.scale;
            zoomToward(newZ, sx, sy);
        };

        canvas.addEventListener('gesturestart', handleGestureStart, { passive: false });
        canvas.addEventListener('gesturechange', handleGestureChange, { passive: false });

        return () => {
            canvas.removeEventListener('wheel', handleWheel);
            canvas.removeEventListener('gesturestart', handleGestureStart);
            canvas.removeEventListener('gesturechange', handleGestureChange);
        };
    }, [zoomToward, clampCamera, scheduleRedraw]);

    // --- Keyboard shortcuts (Space pan, F fit, Arrow nudge) ---
    useEffect(() => {
        const isInput = () => {
            const tag = document.activeElement?.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        };
        const down = (e) => {
            if (isInput()) return;
            if (e.code === 'Space' && !e.repeat) { spaceHeld.current = true; e.preventDefault(); }
            if (e.code === 'KeyF' && !e.repeat) { fitToViewport(); e.preventDefault(); }
            // Arrow keys nudge viewport by 50 board cells
            const nudge = 50;
            if (e.code === 'ArrowLeft') { camera.current.x -= nudge; clampCamera(); scheduleRedraw(); setZoomDisplay(z => z); e.preventDefault(); }
            if (e.code === 'ArrowRight') { camera.current.x += nudge; clampCamera(); scheduleRedraw(); setZoomDisplay(z => z); e.preventDefault(); }
            if (e.code === 'ArrowUp') { camera.current.y -= nudge; clampCamera(); scheduleRedraw(); setZoomDisplay(z => z); e.preventDefault(); }
            if (e.code === 'ArrowDown') { camera.current.y += nudge; clampCamera(); scheduleRedraw(); setZoomDisplay(z => z); e.preventDefault(); }
        };
        const up = (e) => { if (e.code === 'Space') { spaceHeld.current = false; } };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    }, [fitToViewport, clampCamera, scheduleRedraw]);

    // --- Get board pixel from screen event ---
    const getPixelFromEvent = useCallback((e) => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        const board = screenToBoard(sx, sy);
        const gridX = Math.floor(board.x);
        const gridY = Math.floor(board.y);

        if (gridX < 0 || gridX >= BOARD_WIDTH || gridY < 0 || gridY >= BOARD_HEIGHT) return null;
        return { x: gridX, y: gridY };
    }, [screenToBoard]);

    // --- Pointer handlers ---
    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        const canvas = overlayCanvasRef.current;
        if (canvas && typeof canvas.setPointerCapture === 'function' && typeof e.pointerId === 'number') {
            try {
                canvas.setPointerCapture(e.pointerId);
            } catch { }
        }

        const rect = overlayCanvasRef.current.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        // Pan with middle mouse, or Space+left click
        if (e.button === 1 || (e.button === 0 && spaceHeld.current)) {
            isPanning.current = true;
            panStart.current = { x: e.clientX, y: e.clientY };
            panCameraStart.current = { x: camera.current.x, y: camera.current.y };
            overlayCanvasRef.current.style.cursor = 'grabbing';
            return;
        }

        if (e.button !== 0) return;
        const pixel = getPixelFromEvent(e);
        if (!pixel) { setSelectedPixels(new Set()); return; }

        if (typeof window !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(50);
        }

        const key = `${pixel.x},${pixel.y}`;
        const owner = ownedMap.get(key);

        if (owner && owner.ownerUrl) {
            window.open(owner.ownerUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        if (!owner) {
            setIsDragging(true);
            isDraggingRef.current = true;
            setDragStart(pixel);
            setDragEnd(pixel);
            currentDragStart.current = pixel;
            currentDragEnd.current = pixel;
        }
    }, [getPixelFromEvent, ownedMap]);

    const handleMouseMove = useCallback((e) => {
        e.preventDefault();
        if (e.currentTarget === window && !isPanning.current && !isDraggingRef.current) {
            return;
        }

        if (lastCursorPosRef.current.x !== e.clientX || lastCursorPosRef.current.y !== e.clientY) {
            lastCursorPosRef.current = { x: e.clientX, y: e.clientY };
            setCursorPos(lastCursorPosRef.current);
        }

        // Panning
        if (isPanning.current) {
            const dx = e.clientX - panStart.current.x;
            const dy = e.clientY - panStart.current.y;
            camera.current.x = panCameraStart.current.x - dx / camera.current.zoom;
            camera.current.y = panCameraStart.current.y - dy / camera.current.zoom;
            clampCamera();
            scheduleRedraw();
            return;
        }

        // Detect if cursor is near the mini-map zone (bottom-right 200px)
        const container = containerRef.current;
        if (container) {
            const rect = container.getBoundingClientRect();
            const distRight = rect.right - e.clientX;
            const distBottom = rect.bottom - e.clientY;
            const nearMinimap = distRight < 200 && distBottom < 200;
            if (lastNearMinimapRef.current !== nearMinimap) {
                lastNearMinimapRef.current = nearMinimap;
                setCursorNearMinimap(nearMinimap);
            }
        }

        if (isDragging) {
            const pixel = getPixelFromEvent(e);
            currentDragEnd.current = pixel;
            setDragEnd(pixel);
            scheduleRedraw();
        } else {
            const pixel = getPixelFromEvent(e);
            if (!pixel) {
                if (hoveredKeyRef.current !== '') {
                    hoveredKeyRef.current = '';
                    setHoveredPixel(null);
                }
                return;
            }
            const key = `${pixel.x},${pixel.y}`;

            if (lastTooltipPosRef.current.x !== e.clientX || lastTooltipPosRef.current.y !== e.clientY) {
                lastTooltipPosRef.current = { x: e.clientX, y: e.clientY };
                setTooltipPos(lastTooltipPosRef.current);
            }

            const owner = ownedMap.get(key);
            const isOwned = !!owner;

            if (overlayCanvasRef.current) {
                if (spaceHeld.current) {
                    overlayCanvasRef.current.style.cursor = 'grab';
                } else {
                    overlayCanvasRef.current.style.cursor = isOwned ? 'pointer' : 'crosshair';
                }
            }

            const nextHoverKey = isOwned
                ? `${key}:owned:${owner.ownerId || owner.purchaseId || owner.ownerName || ''}`
                : `${key}:free`;

            if (hoveredKeyRef.current !== nextHoverKey) {
                hoveredKeyRef.current = nextHoverKey;
                setHoveredPixel(owner ? { ...owner, x: pixel.x, y: pixel.y, isOwned: true } : { x: pixel.x, y: pixel.y, isOwned: false });
            }
        }
    }, [getPixelFromEvent, isDragging, ownedMap, clampCamera, scheduleRedraw]);

    const handleMouseUp = useCallback((e) => {
        const canvas = overlayCanvasRef.current;
        if (
            canvas
            && typeof e.pointerId === 'number'
            && typeof canvas.hasPointerCapture === 'function'
            && canvas.hasPointerCapture(e.pointerId)
            && typeof canvas.releasePointerCapture === 'function'
        ) {
            try {
                canvas.releasePointerCapture(e.pointerId);
            } catch { }
        }

        if (isPanning.current) {
            isPanning.current = false;
            if (overlayCanvasRef.current) {
                overlayCanvasRef.current.style.cursor = spaceHeld.current ? 'grab' : 'crosshair';
            }
            return;
        }

        if (!isDragging) {
            isDraggingRef.current = false;
            return;
        }
        setIsDragging(false);
        isDraggingRef.current = false;

        if (dragStart && dragEnd) {
            const isClick = dragStart.x === dragEnd.x && dragStart.y === dragEnd.y;
            setSelectedPixels(prev => {
                const key = `${dragStart.x},${dragStart.y}`;
                if (isClick && getPixelState(dragStart.x, dragStart.y) === 'OWNED') return prev;

                if (isClick) {
                    return prev.has(key) ? new Set() : new Set([key]);
                } else {
                    const minX = Math.min(dragStart.x, dragEnd.x);
                    const maxX = Math.max(dragStart.x, dragEnd.x);
                    const minY = Math.min(dragStart.y, dragEnd.y);
                    const maxY = Math.max(dragStart.y, dragEnd.y);

                    let isInvalid = false;
                    for (let x = minX; x <= maxX; x++) {
                        for (let y = minY; y <= maxY; y++) {
                            if (getPixelState(x, y) === 'OWNED') { isInvalid = true; break; }
                        }
                    }
                    if (isInvalid) {
                        setToastMessage("Selected space overlaps owned pixels. Please find an empty rectangle.");
                        setTimeout(() => setToastMessage(null), 3000);
                        return prev;
                    }

                    const newSet = new Set();
                    for (let x = minX; x <= maxX; x++) {
                        for (let y = minY; y <= maxY; y++) {
                            newSet.add(`${x},${y}`);
                        }
                    }
                    return newSet;
                }
            });
        }
        setDragStart(null);
        setDragEnd(null);
        currentDragStart.current = null;
        currentDragEnd.current = null;
    }, [isDragging, dragStart, dragEnd, getPixelState]);

    const handleMouseLeave = useCallback(() => {
        if (hoveredKeyRef.current !== '') {
            hoveredKeyRef.current = '';
            setHoveredPixel(null);
        }
    }, []);

    // ── Mobile gesture helpers ────────────────────────────────────────────
    const touchDist = useCallback((t1, t2) => {
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }, []);

    const touchMid = useCallback((t1, t2) => ({
        clientX: (t1.clientX + t2.clientX) / 2,
        clientY: (t1.clientY + t2.clientY) / 2,
    }), []);

    const resetTouchState = useCallback(() => {
        const ts = touchState.current;
        if (ts.waitTimer) { clearTimeout(ts.waitTimer); ts.waitTimer = null; }
        ts.type = 'none';
        ts.startTouches = null;
        ts.startCamera = null;
        ts.startDist = 0;
        ts.startZoom = 0;
        ts.startMidBoard = null;
    }, []);

    // ── Touch event handlers (mobile gestures) ─────────────────────────
    const handleTouchStart = useCallback((e) => {
        e.preventDefault();
        const ts = touchState.current;
        const touches = e.touches;

        if (touches.length === 2) {
            // Immediately switch to pinch mode — cancel any pending wait/select
            if (ts.waitTimer) { clearTimeout(ts.waitTimer); ts.waitTimer = null; }
            // If we were in the middle of a drag-select, cancel it
            if (isDraggingRef.current) {
                setIsDragging(false);
                isDraggingRef.current = false;
                setDragStart(null);
                setDragEnd(null);
                currentDragStart.current = null;
                currentDragEnd.current = null;
            }

            const d = touchDist(touches[0], touches[1]);
            const mid = touchMid(touches[0], touches[1]);
            const rect = overlayCanvasRef.current.getBoundingClientRect();
            const sx = mid.clientX - rect.left;
            const sy = mid.clientY - rect.top;
            const c = camera.current;

            ts.type = 'pinch';
            ts.startDist = d;
            ts.startZoom = c.zoom;
            ts.startCamera = { x: c.x, y: c.y };
            ts.startMidBoard = { boardX: sx / c.zoom + c.x, boardY: sy / c.zoom + c.y, sx, sy };
            ts.startTouches = [
                { clientX: touches[0].clientX, clientY: touches[0].clientY },
                { clientX: touches[1].clientX, clientY: touches[1].clientY },
            ];
            return;
        }

        if (touches.length === 1 && ts.type === 'none') {
            // Single finger — wait briefly to see if a second finger arrives (pinch)
            const touch = touches[0];
            ts.type = 'waiting';
            ts.startTouches = [{ clientX: touch.clientX, clientY: touch.clientY }];
            ts.startCamera = { x: camera.current.x, y: camera.current.y };

            ts.waitTimer = setTimeout(() => {
                // Timer expired with one finger still down → treat as select
                ts.waitTimer = null;
                if (ts.type !== 'waiting') return;
                ts.type = 'select';
                // Synthesize a pointerdown for the selection system
                const fakeEvent = {
                    clientX: ts.startTouches[0].clientX,
                    clientY: ts.startTouches[0].clientY,
                    button: 0,
                    pointerId: undefined,
                    preventDefault: () => {},
                    currentTarget: overlayCanvasRef.current,
                };
                handleMouseDown(fakeEvent);
            }, 80);
        }
    }, [touchDist, touchMid, resetTouchState, handleMouseDown]);

    const handleTouchMove = useCallback((e) => {
        e.preventDefault();
        const ts = touchState.current;
        const touches = e.touches;

        if (ts.type === 'pinch' && touches.length >= 2) {
            const d = touchDist(touches[0], touches[1]);
            const mid = touchMid(touches[0], touches[1]);
            const rect = overlayCanvasRef.current.getBoundingClientRect();
            const sx = mid.clientX - rect.left;
            const sy = mid.clientY - rect.top;

            // Compute new zoom
            const scale = d / ts.startDist;
            const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, ts.startZoom * scale));

            // Pan: keep the board point under the initial midpoint stationary
            const mp = ts.startMidBoard;
            const c = camera.current;
            c.zoom = newZoom;
            c.x = mp.boardX - sx / newZoom;
            c.y = mp.boardY - sy / newZoom;
            targetZoom.current = newZoom;

            clampCamera();
            setZoomDisplay(newZoom);
            scheduleRedraw();
            return;
        }

        if (ts.type === 'waiting' && touches.length === 1) {
            // Check if finger moved enough to reclassify as pan
            const dx = touches[0].clientX - ts.startTouches[0].clientX;
            const dy = touches[0].clientY - ts.startTouches[0].clientY;
            if (Math.abs(dx) + Math.abs(dy) > 8) {
                // Promote to pan immediately
                if (ts.waitTimer) { clearTimeout(ts.waitTimer); ts.waitTimer = null; }
                ts.type = 'pan';
                ts.startTouches = [{ clientX: touches[0].clientX, clientY: touches[0].clientY }];
                ts.startCamera = { x: camera.current.x, y: camera.current.y };
            }
            return;
        }

        if (ts.type === 'pan' && touches.length === 1) {
            const dx = touches[0].clientX - ts.startTouches[0].clientX;
            const dy = touches[0].clientY - ts.startTouches[0].clientY;
            const c = camera.current;
            c.x = ts.startCamera.x - dx / c.zoom;
            c.y = ts.startCamera.y - dy / c.zoom;
            clampCamera();
            scheduleRedraw();
            return;
        }

        if (ts.type === 'select' && touches.length === 1) {
            // Forward to drag/hover handler
            const fakeEvent = {
                clientX: touches[0].clientX,
                clientY: touches[0].clientY,
                button: 0,
                pointerId: undefined,
                preventDefault: () => {},
                currentTarget: overlayCanvasRef.current,
            };
            handleMouseMove(fakeEvent);
        }
    }, [touchDist, touchMid, clampCamera, scheduleRedraw, handleMouseMove]);

    const handleTouchEnd = useCallback((e) => {
        e.preventDefault();
        const ts = touchState.current;

        if (ts.type === 'pinch' && e.touches.length < 2) {
            // Pinch ended — if one finger remains, switch to pan
            if (e.touches.length === 1) {
                ts.type = 'pan';
                ts.startTouches = [{ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }];
                ts.startCamera = { x: camera.current.x, y: camera.current.y };
            } else {
                resetTouchState();
            }
            return;
        }

        if (ts.type === 'waiting') {
            // Finger released quickly without moving → tap → select pixel
            if (ts.waitTimer) { clearTimeout(ts.waitTimer); ts.waitTimer = null; }
            const t = ts.startTouches[0];
            const fakeDown = {
                clientX: t.clientX,
                clientY: t.clientY,
                button: 0,
                pointerId: undefined,
                preventDefault: () => {},
                currentTarget: overlayCanvasRef.current,
            };
            handleMouseDown(fakeDown);
            // Immediately follow with mouseUp so it registers as a tap/click
            setTimeout(() => {
                const fakeUp = {
                    clientX: t.clientX,
                    clientY: t.clientY,
                    button: 0,
                    pointerId: undefined,
                    preventDefault: () => {},
                    currentTarget: overlayCanvasRef.current,
                };
                handleMouseUp(fakeUp);
            }, 0);
            resetTouchState();
            return;
        }

        if (ts.type === 'select') {
            // Forward end to mouseUp
            const touch = e.changedTouches[0];
            if (touch) {
                const fakeEvent = {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    button: 0,
                    pointerId: undefined,
                    preventDefault: () => {},
                    currentTarget: overlayCanvasRef.current,
                };
                handleMouseUp(fakeEvent);
            }
            resetTouchState();
            return;
        }

        if (e.touches.length === 0) {
            resetTouchState();
        }
    }, [handleMouseDown, handleMouseUp, resetTouchState]);

    // ── Attach unified pointer/mouse/touch events ──────────────────────
    useEffect(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const supportsPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window;

        // Touch events — dedicated gesture handling (mobile)
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

        // Pointer events — for mouse / stylus / single-pointer desktop (primary)
        if (supportsPointerEvents) {
            canvas.addEventListener('pointerdown', handleMouseDown, { passive: false });
            canvas.addEventListener('pointermove', handleMouseMove, { passive: false });
            window.addEventListener('pointermove', handleMouseMove, { passive: false });
            window.addEventListener('pointerup', handleMouseUp);
            window.addEventListener('pointercancel', handleMouseUp);
        } else {
            // Fallback: plain mouse events
            canvas.addEventListener('mousedown', handleMouseDown, { passive: false });
            window.addEventListener('mousemove', handleMouseMove, { passive: false });
            window.addEventListener('mouseup', handleMouseUp);
        }
        canvas.addEventListener('pointerleave', handleMouseLeave);

        return () => {
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchmove', handleTouchMove);
            canvas.removeEventListener('touchend', handleTouchEnd);
            canvas.removeEventListener('touchcancel', handleTouchEnd);

            if (supportsPointerEvents) {
                canvas.removeEventListener('pointerdown', handleMouseDown);
                canvas.removeEventListener('pointermove', handleMouseMove);
                window.removeEventListener('pointermove', handleMouseMove);
                window.removeEventListener('pointerup', handleMouseUp);
                window.removeEventListener('pointercancel', handleMouseUp);
            } else {
                canvas.removeEventListener('mousedown', handleMouseDown);
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            }
            canvas.removeEventListener('pointerleave', handleMouseLeave);
        };
    }, [handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, handleTouchStart, handleTouchMove, handleTouchEnd]);

    const handleCheckoutClick = () => {
        if (!user) { setAuthModalOpen(true); return; }
        setPurchaseModalOpen(true);
    };

    // Purchase handler
    const handlePurchase = async ({ brandName, brandUrl, logoFile, fitMode, imageWidth, imageHeight }) => {
        const coords = Array.from(selectedPixels).map(key => ({
            x: parseInt(key.split(',')[0], 10),
            y: parseInt(key.split(',')[1], 10)
        }));

        setPurchaseError('');
        setUploadProgress(0);

        const backupPixels = queryClient.getQueryData(['pixels']);

        const optimisticLogoUrl = logoFile ? URL.createObjectURL(logoFile) : null;
        const optimisticPixels = coords.map(c => ({
            x: c.x,
            y: c.y,
            brandName,
            brandUrl,
            logoUrl: optimisticLogoUrl,
            fitMode,
            imageWidth,
            imageHeight,
            color: user?.buyer?.color || '#000000',
            isOwned: true
        }));

        queryClient.setQueryData(['pixels'], old => [...(old || []), ...optimisticPixels]);

        setIsProcessing(true);

        try {
            await purchase({
                pixels: coords,
                brandName,
                brandUrl,
                file: logoFile,
                fitMode,
                imageWidth,
                imageHeight,
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                }
            });

            setPurchaseModalOpen(false);
            setSelectedPixels(new Set());
            setQuantityInput('');
            setWidthInput('');
            setHeightInput('');
            setPurchaseKey(k => k + 1);
            await queryClient.invalidateQueries({ queryKey: ['pixels'] });
            await queryClient.invalidateQueries({ queryKey: ['stats'] });
            await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
            await queryClient.invalidateQueries({ queryKey: ['buyers'] });
            await queryClient.invalidateQueries({ queryKey: ['auth'] });
            refresh();

            // Trigger purchase highlight animation (Feature 11)
            if (coords.length > 0) {
                const pxs = coords.map(c => c.x);
                const pys = coords.map(c => c.y);
                purchaseHighlight.current = {
                    bounds: { minX: Math.min(...pxs), minY: Math.min(...pys), maxX: Math.max(...pxs), maxY: Math.max(...pys) },
                    startTime: performance.now()
                };
                scheduleRedraw();
            }
        } catch (err) {
            queryClient.setQueryData(['pixels'], backupPixels);
            const timeoutError = err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '');
            const errorMessage = timeoutError
                ? 'Purchase request timed out after 30 seconds. Please try again.'
                : (err?.response?.data?.message || 'Purchase failed. Pixels may already be taken or overlap existing ones.');
            setPurchaseError(errorMessage);
            setToastMessage(errorMessage);
            setTimeout(() => setToastMessage(null), 3000);
            queueViewportFetch(true);
        } finally {
            setIsProcessing(false);
        }
    };

    // Block allocation
    const allocateBlock = useCallback((blockW, blockH) => {
        const newSet = new Set();
        let found = false;

        for (let y = 0; y <= BOARD_HEIGHT - blockH && !found; y++) {
            for (let x = 0; x <= BOARD_WIDTH - blockW && !found; x++) {
                let allFree = true;
                for (let dy = 0; dy < blockH && allFree; dy++) {
                    for (let dx = 0; dx < blockW && allFree; dx++) {
                        if (getPixelState(x + dx, y + dy) === 'OWNED') allFree = false;
                    }
                }
                if (allFree) {
                    for (let dy = 0; dy < blockH; dy++) {
                        for (let dx = 0; dx < blockW; dx++) {
                            newSet.add(`${x + dx},${y + dy}`);
                        }
                    }
                    found = true;
                }
            }
        }
        if (!found) {
            setToastMessage('No space for this block. Try smaller.');
            setTimeout(() => setToastMessage(null), 3000);
        } else {
            setSelectedPixels(newSet);
        }
    }, [getPixelState]);

    const dragPixelCount = (isDragging && dragStart && dragEnd)
        ? (Math.abs(dragEnd.x - dragStart.x) + 1) * (Math.abs(dragEnd.y - dragStart.y) + 1)
        : 0;

    const zoomPercent = Math.round(zoomDisplay * 100);

    return (
        <section id="board" className="bg-[var(--color-surface-elevated)] border-y border-[var(--color-border-subtle)] py-20 w-full relative">
            <div className="px-6 max-w-6xl mx-auto">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">Core Canvas</h2>
                        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
                            {BOARD_WIDTH}×{BOARD_HEIGHT} grid — 1,000,000 pixels — Buy rectangular pixel blocks
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-white border border-[var(--color-border)] rounded-lg p-1">
                            <button onClick={() => updateTargetZoom(camera.current.zoom * 0.7)} className="w-8 h-8 flex items-center justify-center rounded text-sm hover:bg-gray-100 transition-colors">−</button>
                            <button onClick={() => fitToViewport()} className="px-2 h-8 flex items-center justify-center rounded text-xs font-medium hover:bg-gray-100 transition-colors">{zoomPercent}%</button>
                            <button onClick={() => updateTargetZoom(camera.current.zoom * 1.4)} className="w-8 h-8 flex items-center justify-center rounded text-sm hover:bg-gray-100 transition-colors">+</button>
                        </div>
                        <button onClick={() => fitToViewport()} className="text-xs font-medium text-[var(--color-text-tertiary)] bg-white border border-[var(--color-border)] rounded-lg px-3 h-8 hover:bg-gray-50 transition-colors" title="Fit board to screen">
                            Fit
                        </button>
                        <button
                            onClick={() => setHeatmapVisible(v => !v)}
                            className={`text-xs font-medium border rounded-lg px-3 h-8 transition-colors ${heatmapVisible
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                    : 'bg-white border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:bg-gray-50'
                                }`}
                            title="Toggle heatmap overlay"
                        >
                            🗺 Heatmap
                        </button>
                    </div>
                    <BrandSearch ownedPixels={ownedPixels} onSelectBrand={panToBrand} />
                </div>

                <AnimatePresence>
                    {toastMessage && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -20 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 text-white text-sm font-medium px-6 py-3 rounded-full shadow-2xl z-50 pointer-events-none"
                        >
                            {toastMessage}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Selection methods */}
                <div className="flex flex-wrap items-end gap-4 mb-4 p-3 bg-white border border-[var(--color-border)] rounded-xl shadow-sm">
                    <div className="flex items-end gap-2">
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Pixel count</label>
                            <Input
                                type="number" min="1" value={quantityInput} onChange={e => setQuantityInput(e.target.value)}
                                placeholder="e.g. 5000" className="w-24 px-3 py-1.5 min-h-[32px] text-sm"
                            />
                        </div>
                        <Button
                            onClick={() => {
                                const n = parseInt(quantityInput, 10);
                                if (n > 0) {
                                    let w = Math.floor(Math.sqrt(n));
                                    while (n % w !== 0 && w > 1) { w--; }
                                    allocateBlock(w, Math.floor(n / w));
                                }
                                else alert('Enter a value greater than 0');
                            }}
                            className="px-3 py-1.5 text-sm rounded shadow-none"
                        >Select</Button>
                    </div>
                    <div className="w-px h-8 bg-gray-200"></div>
                    <div className="flex items-end gap-2">
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Width</label>
                            <Input
                                type="number" min="1" max="1000" value={widthInput} onChange={e => setWidthInput(e.target.value)}
                                placeholder="W" className="w-16 px-2 py-1.5 min-h-[32px] text-sm"
                            />
                        </div>
                        <span className="text-[var(--color-text-tertiary)] text-sm pb-1.5">×</span>
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Height</label>
                            <Input
                                type="number" min="1" max="1000" value={heightInput} onChange={e => setHeightInput(e.target.value)}
                                placeholder="H" className="w-16 px-2 py-1.5 min-h-[32px] text-sm"
                            />
                        </div>
                        <Button
                            onClick={() => {
                                const w = parseInt(widthInput, 10);
                                const h = parseInt(heightInput, 10);
                                if (w > 0 && h > 0) allocateBlock(w, h);
                            }}
                            className="px-3 py-1.5 text-sm rounded shadow-none"
                        >Select</Button>
                    </div>
                    <div className="w-px h-8 bg-gray-200"></div>
                    <p className="text-xs text-[var(--color-text-tertiary)] pb-2">
                        drag canvas to select · hold <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Space</kbd> + drag to pan · scroll to zoom
                    </p>
                </div>

                {isLoading && (
                    <div className="w-full aspect-video bg-gray-50/50 backdrop-blur-md rounded-2xl border border-gray-200/50 shadow-sm overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                        <div className="w-full h-full grid grid-cols-12 gap-2 p-6 opacity-20">
                            {Array.from({ length: 144 }).map((_, i) => <div key={i} className="bg-gray-300 rounded-sm" />)}
                        </div>
                    </div>
                )}

                {/* Canvas viewport */}
                <div
                    ref={containerRef}
                    className="bg-gray-100 rounded-2xl border border-gray-300 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative"
                    style={{ height: 'calc(100vh - 280px)', minHeight: 400 }}
                >
                    <canvas
                        ref={canvasRef}
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: '100%',
                            height: '100%',
                            imageRendering: 'pixelated',
                            touchAction: 'none',
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                        }}
                    />
                    <canvas
                        ref={overlayCanvasRef}
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: '100%',
                            height: '100%',
                            cursor: 'crosshair',
                            touchAction: 'none',
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                        }}
                        onDragStart={(e) => e.preventDefault()}
                    />
                    <HeatmapOverlay
                        camera={camera}
                        canvasSize={canvasSize}
                        ownedPixels={ownedPixels}
                        visible={heatmapVisible}
                    />
                    <MiniMapCanvas
                        camera={camera}
                        canvasSize={canvasSize}
                        ownedPixels={ownedPixels}
                        onNavigate={onMiniMapNavigate}
                        zoomDisplay={zoomDisplay}
                        cursorNear={cursorNearMinimap}
                    />
                </div>

                {isDragging && dragPixelCount > 0 && (
                    <div
                        className="fixed -translate-x-1/2 z-[100] bg-black text-white text-sm font-bold px-4 py-2 rounded-full shadow pointer-events-none transition-colors"
                        style={{
                            left: cursorPos.x,
                            top: cursorPos.y - 50
                        }}
                    >
                        {dragPixelCount} px
                    </div>
                )}

                {hoveredPixel && (
                    <div className="fixed z-[100] pointer-events-none" style={{ left: tooltippos.x + 12, top: tooltippos.y + 12 }}>
                        {!hoveredPixel.isOwned ? (
                            <div className="bg-white/90 backdrop-blur-md rounded-xl px-4 py-2.5 shadow-lg border border-white/40">
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-[11px] text-gray-400 tracking-tight">{hoveredPixel.x}, {hoveredPixel.y}</span>
                                    <span className="w-px h-3 bg-gray-200"></span>
                                    <span className="text-xs font-semibold text-emerald-600">Available</span>
                                    <span className="w-px h-3 bg-gray-200"></span>
                                    <span className="text-xs font-medium text-gray-500">₹100/px</span>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white/95 backdrop-blur-md border border-gray-200 shadow-xl rounded-xl p-3.5 text-sm text-gray-800 min-w-[220px]">
                                <p className="font-bold text-gray-900 mb-1.5 leading-tight text-[15px]">{hoveredPixel.ownerName || 'Claimed Space'}</p>
                                {hoveredPixel.ownerUrl && (
                                    <p className="text-[11px] text-blue-500 font-medium mb-2 truncate">
                                        {(() => { try { return new URL(hoveredPixel.ownerUrl.startsWith('http') ? hoveredPixel.ownerUrl : 'https://' + hoveredPixel.ownerUrl).hostname; } catch { return hoveredPixel.ownerUrl; } })()}
                                    </p>
                                )}
                                <div className="space-y-0.5 mb-2">
                                    <p className="text-xs text-gray-500">Pixels owned: <span className="font-semibold text-gray-700">{hoveredPixel.ownerPixelCount || 1}</span></p>
                                    <p className="text-xs text-gray-500">Rank: <span className="font-semibold text-gray-700">#{hoveredPixel.ownerRank || '-'}</span></p>
                                    <p className="text-xs text-gray-500">Block area: <span className="font-semibold text-gray-700">{hoveredPixel.blockArea || 1}</span></p>
                                    <p className="text-xs text-gray-500">Position: <span className="font-mono text-gray-700">{hoveredPixel.x}, {hoveredPixel.y}</span></p>
                                </div>
                                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                                    <span className="text-[11px] text-gray-400 font-medium">Click to visit ↗</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {selectedPixels.size > 0 && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] animate-slide-in">
                        <div className="bg-white shadow-2xl px-6 py-4 rounded-2xl flex items-center gap-6 border border-gray-200">
                            <div className="flex flex-col gap-0.5">
                                <p className="text-xs font-medium text-gray-500">
                                    <span className="font-bold text-gray-900">{selectedPixels.size}</span> pixels selected
                                </p>
                                <p className="text-xs font-medium text-gray-500">Price: <span className="text-gray-900">₹100</span> / px</p>
                                <p className="text-sm font-bold text-gray-900 mt-1">Total: ₹{(selectedPixels.size * 100).toLocaleString('en-IN')}</p>
                            </div>
                            <div className="w-px h-10 bg-gray-200"></div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedPixels(new Set())} className="text-xs font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">Cancel</button>
                                <Button onClick={handleCheckoutClick} className="bg-[var(--color-accent)] text-white px-6 py-2.5 rounded-xl text-sm transition shadow-none hover:bg-blue-700">
                                    Secure Pixels
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
            <PurchaseModal
                key={purchaseKey} isOpen={purchaseModalOpen} onClose={() => { setPurchaseModalOpen(false); setPurchaseError(''); }}
                onSubmit={handlePurchase} selectedCount={selectedPixels.size} pricePerPixel={100} isPurchasing={isProcessing}
                purchaseError={purchaseError} setPurchaseError={setPurchaseError} uploadProgress={uploadProgress}
            />
        </section>
    );
}
