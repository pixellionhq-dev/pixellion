import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
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
import { resolveLogoUrl as resolveLogoUrlUtil } from '../utils/resolveLogoUrl';
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

export default function PixelBoard({ leaderboardOpen = false }) {
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
    const [focusedBrand, setFocusedBrand] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
    const canvasSizeRef = useRef(canvasSize);
    canvasSizeRef.current = canvasSize;

    // Spring-physics tooltip position (zero re-renders on mousemove)
    const rawTooltipX = useMotionValue(-9999);
    const rawTooltipY = useMotionValue(-9999);
    const springTooltipX = useSpring(rawTooltipX, { damping: 26, stiffness: 380, mass: 0.35 });
    const springTooltipY = useSpring(rawTooltipY, { damping: 26, stiffness: 380, mass: 0.35 });

    // Smart tooltip positioning — keeps tooltip within viewport + below navbar
    const TOOLTIP_W = 304;
    const TOOLTIP_H = 220;
    const TOOLTIP_OFFSET = 16;
    const smartTooltipX = useTransform(springTooltipX, v => {
        const right = v + TOOLTIP_OFFSET + TOOLTIP_W;
        return right > (typeof window !== 'undefined' ? window.innerWidth : 9999) - 8
            ? v - TOOLTIP_OFFSET - TOOLTIP_W
            : v + TOOLTIP_OFFSET;
    });
    const smartTooltipY = useTransform(springTooltipY, v => {
        const NAVBAR_H = 60;
        const bottom = v + TOOLTIP_OFFSET + TOOLTIP_H;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 9999;
        if (bottom > vh - 8) return v - TOOLTIP_OFFSET - TOOLTIP_H;
        const top = v + TOOLTIP_OFFSET;
        return top < NAVBAR_H ? NAVBAR_H + 4 : top;
    });

    // Particle burst canvas
    const burstCanvasRef = useRef(null);
    const burstParticlesRef = useRef([]);
    const burstRafRef = useRef(null);
    const BURST_COLORS = ['#0066CC', '#FF3B30', '#34C759', '#FF9500', '#AF52DE', '#FF2D55'];

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

    // Fast lookup: purchaseId → block bounds (for hover glow)
    const blockByPurchaseId = useMemo(() => {
        const map = new Map();
        precomputedBlocks.forEach(b => map.set(b.groupId, b));
        return map;
    }, [precomputedBlocks]);
    const blockByPurchaseIdRef = useRef(blockByPurchaseId);
    useEffect(() => { blockByPurchaseIdRef.current = blockByPurchaseId; }, [blockByPurchaseId]);

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
        const { w, h } = canvasSizeRef.current;
        if (!w || !h || !c.zoom) return null;

        const minX = Math.max(0, Math.floor(c.x));
        const minY = Math.max(0, Math.floor(c.y));
        const maxX = Math.min(BOARD_WIDTH - 1, Math.ceil(c.x + w / c.zoom));
        const maxY = Math.min(BOARD_HEIGHT - 1, Math.ceil(c.y + h / c.zoom));

        if (maxX < minX || maxY < minY) return null;
        return { minX, minY, maxX, maxY };
    }, []);

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
        const { w, h } = canvasSizeRef.current;
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
    }, []);

    // --- Fit entire board in view ---
    const fitToViewport = useCallback(() => {
        const { w, h } = canvasSizeRef.current;
        if (w === 0 || h === 0) return;

        // Add 5% padding so the board doesn't touch the container edges
        const padding = 0.90; // use 90% of available space
        const fitZoom = Math.min(w / BOARD_WIDTH, h / BOARD_HEIGHT) * padding;

        // Center: set camera.x/y so the board is in the middle of the viewport
        camera.current.zoom = fitZoom;
        camera.current.x = BOARD_WIDTH / 2 - (w / fitZoom) / 2;
        camera.current.y = BOARD_HEIGHT / 2 - (h / fitZoom) / 2;
        targetZoom.current = fitZoom;
        setZoomDisplay(fitZoom);
    }, []);

    // --- Resize observer ---
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                const w = Math.floor(width);
                const h = Math.floor(height);
                
                // Sync both state AND ref immediately
                setCanvasSize({ w, h });
                canvasSizeRef.current = { w, h };

                // Directly resize the canvas internal buffers so they don't stay at 300x150
                const dpr = window.devicePixelRatio || 1;
                const baseCanvas = canvasRef.current;
                const overlayCanvas = overlayCanvasRef.current;
                if (baseCanvas && (baseCanvas.width !== w * dpr || baseCanvas.height !== h * dpr)) {
                    baseCanvas.width = w * dpr;
                    baseCanvas.height = h * dpr;
                    baseCanvas.style.width = `${w}px`;
                    baseCanvas.style.height = `${h}px`;
                    const ctx = baseCanvas.getContext('2d');
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                }
                if (overlayCanvas && (overlayCanvas.width !== w * dpr || overlayCanvas.height !== h * dpr)) {
                    overlayCanvas.width = w * dpr;
                    overlayCanvas.height = h * dpr;
                    overlayCanvas.style.width = `${w}px`;
                    overlayCanvas.style.height = `${h}px`;
                    const ctx = overlayCanvas.getContext('2d');
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                }
                const burstCanvas = burstCanvasRef.current;
                if (burstCanvas && (burstCanvas.width !== w * dpr || burstCanvas.height !== h * dpr)) {
                    burstCanvas.width = w * dpr;
                    burstCanvas.height = h * dpr;
                    burstCanvas.style.width = `${w}px`;
                    burstCanvas.style.height = `${h}px`;
                }

                // Trigger a redraw with the fresh dimensions
                // Use queueMicrotask to run after this callback but before next paint
                queueMicrotask(() => requestRedrawRef.current());
            }
        });
        ro.observe(container);
        return () => ro.disconnect();
    }, []);

    // Fit on first meaningful size — animate zoom from 0.25 → fitZoom over 1200ms (easeOutExpo)
    const hasInitialized = useRef(false);
    useEffect(() => {
        if (canvasSize.w > 100 && canvasSize.h > 100 && !hasInitialized.current) {
            hasInitialized.current = true;

            const { w, h } = canvasSize;
            const padding = 0.90;
            const fitZoom = Math.min(w / BOARD_WIDTH, h / BOARD_HEIGHT) * padding;

            // Position camera centered on board (at fitZoom) then start at zoom 0.25
            camera.current.x = BOARD_WIDTH / 2 - w / fitZoom / 2;
            camera.current.y = BOARD_HEIGHT / 2 - h / fitZoom / 2;
            camera.current.zoom = 0.25;
            targetZoom.current = 0.25;

            queueViewportFetch(true);
            setTimeout(() => requestRedrawRef.current(), 0);

            // Animate to fitZoom
            const startZoom = 0.25;
            const endZoom = fitZoom;
            const duration = 1200;
            const t0 = performance.now();
            const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

            const anim = () => {
                const t = Math.min(1, (performance.now() - t0) / duration);
                const z = startZoom + (endZoom - startZoom) * easeOutExpo(t);
                camera.current.x = BOARD_WIDTH / 2 - w / z / 2;
                camera.current.y = BOARD_HEIGHT / 2 - h / z / 2;
                camera.current.zoom = z;
                targetZoom.current = z;
                setZoomDisplay(z);
                requestRedrawRef.current();
                if (t < 1) requestAnimationFrame(anim);
            };
            requestAnimationFrame(anim);
        }
    }, [canvasSize, queueViewportFetch]);


    // --- Draw base board (grid + owned pixels + logos) ---
    const drawBaseBoard = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const { w, h } = canvasSizeRef.current;
        if (!w || !h) return;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
        }
        // Always set transform unconditionally — critical for DPR scaling
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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

            // 4. Draw logos
            ctx.imageSmoothingEnabled = true;
            visibleDrawBlocks.forEach(({ block, tl, br, drawW, drawH }) => {
                const logoToUse = block.ownerLogo || block.logoUrl;
                if (!logoToUse) return;
                const resolvedLogoUrl = resolveLogoUrl(logoToUse);
                if (!resolvedLogoUrl) return;

                // Skip if too small to see
                if (drawW < 2 || drawH < 2) return;

                const entry = ImageCache.load(resolvedLogoUrl);

                if (entry && entry.status === 'ready' && entry.img) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(tl.x, tl.y, drawW, drawH);
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
                } else if (drawW > 20 && drawH > 12) {
                    // Show loading/error placeholder with brand initial
                    const isError = entry && entry.status === 'error';
                    
                    // Always draw an opaque background first so the text is visible over the black canvas pixels
                    ctx.fillStyle = isError ? '#F3F4F6' : 'rgba(255, 255, 255, 0.8)';
                    ctx.fillRect(tl.x, tl.y, drawW, drawH);

                    // Draw brand initial letter
                    const brandName = block.groupId ? String(block.groupId).charAt(0).toUpperCase() : '?';
                    const fontSize = Math.max(8, Math.min(drawW * 0.4, drawH * 0.5, 32));
                    ctx.fillStyle = isError ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)';
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

            ctx.imageSmoothingEnabled = false;

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
    }, [precomputedBlocks, boardToScreen, drawLogoWithFit, resolveLogoUrl]);

    // --- Draw overlay (hover, selection, drag preview) ---
    const drawOverlayBoard = useCallback(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const { w, h } = canvasSizeRef.current;
        if (!w || !h) return;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
        }
        // Always set transform unconditionally — critical for DPR scaling
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            ctx.clearRect(0, 0, w, h);
            const c = camera.current;

            // Hover glow — block-level pulsing rings for owned pixels, dashed for free
            if (hoveredPixel && !isDragging) {
                const now = performance.now();
                if (hoveredPixel.isOwned) {
                    // Find full block bounds
                    const block = blockByPurchaseIdRef.current.get(hoveredPixel.purchaseId);
                    const bMinX = block ? block.minX : hoveredPixel.x;
                    const bMinY = block ? block.minY : hoveredPixel.y;
                    const bMaxX = block ? block.maxX : hoveredPixel.x;
                    const bMaxY = block ? block.maxY : hoveredPixel.y;

                    const tl = boardToScreen(bMinX, bMinY);
                    const br = boardToScreen(bMaxX + 1, bMaxY + 1);
                    const bw = br.x - tl.x;
                    const bh = br.y - tl.y;
                    const cx = tl.x + bw / 2;
                    const cy = tl.y + bh / 2;

                    ctx.save();

                    // Outer glow halo
                    const glowSize = 18 + Math.sin(now / 600) * 4;
                    const glowGrad = ctx.createRadialGradient(cx, cy, Math.max(bw, bh) * 0.3, cx, cy, Math.max(bw, bh) * 0.7 + glowSize);
                    glowGrad.addColorStop(0, 'rgba(99, 102, 241, 0)');
                    glowGrad.addColorStop(1, 'rgba(99, 102, 241, 0.18)');
                    ctx.fillStyle = glowGrad;
                    ctx.fillRect(tl.x - glowSize, tl.y - glowSize, bw + glowSize * 2, bh + glowSize * 2);

                    // Solid block outline with glow
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = 'rgba(99, 102, 241, 0.7)';
                    ctx.strokeStyle = 'rgba(99, 102, 241, 0.95)';
                    ctx.lineWidth = 2.5;
                    ctx.setLineDash([]);
                    ctx.strokeRect(tl.x, tl.y, bw, bh);
                    ctx.shadowBlur = 0;

                    // Pulsing concentric rings (3 rings, staggered)
                    for (let ring = 0; ring < 3; ring++) {
                        const phase = (now / 1200 + ring * 0.33) % 1;
                        const expand = phase * (28 + ring * 8);
                        const alpha = (1 - phase) * (0.55 - ring * 0.12);
                        if (alpha <= 0) continue;
                        ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
                        ctx.lineWidth = 1.5 - ring * 0.3;
                        ctx.setLineDash([]);
                        ctx.strokeRect(
                            tl.x - expand,
                            tl.y - expand,
                            bw + expand * 2,
                            bh + expand * 2
                        );
                    }

                    ctx.restore();
                } else {
                    // Available pixel — dashed border only
                    const tl = boardToScreen(hoveredPixel.x, hoveredPixel.y);
                    const br = boardToScreen(hoveredPixel.x + 1, hoveredPixel.y + 1);
                    ctx.save();
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = 'rgba(37, 99, 235, 0.4)';
                    ctx.strokeStyle = 'rgba(37, 99, 235, 0.8)';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.lineDashOffset = -(now / 50);
                    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
                    ctx.restore();
                }
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
    }, [selectedPixels, hoveredPixel, isDragging, boardToScreen, ownedMap]);

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

    // FIX 7 — Smoothly re-center the board when leaderboard panel opens/closes
    const prevLeaderboardOpenRef = useRef(leaderboardOpen);
    useEffect(() => {
        if (prevLeaderboardOpenRef.current === leaderboardOpen) return;
        prevLeaderboardOpenRef.current = leaderboardOpen;
        // Start animation slightly after CSS transition begins (50ms) so canvas size is updating
        const timer = setTimeout(() => {
            const { w, h } = canvasSizeRef.current;
            if (!w || !h) return;
            const padding = 0.90;
            const newFitZoom = Math.min(w / BOARD_WIDTH, h / BOARD_HEIGHT) * padding;
            const endX = BOARD_WIDTH / 2 - (w / newFitZoom) / 2;
            const endY = BOARD_HEIGHT / 2 - (h / newFitZoom) / 2;

            const c = camera.current;
            const startX = c.x, startY = c.y, startZoom = c.zoom;
            const t0 = performance.now();
            const duration = 380;
            const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

            const anim = () => {
                const elapsed = performance.now() - t0;
                const e = easeInOut(Math.min(1, elapsed / duration));
                c.x = startX + (endX - startX) * e;
                c.y = startY + (endY - startY) * e;
                c.zoom = startZoom + (newFitZoom - startZoom) * e;
                targetZoom.current = c.zoom;
                setZoomDisplay(c.zoom);
                scheduleRedraw();
                if (elapsed < duration) requestAnimationFrame(anim);
            };
            requestAnimationFrame(anim);
        }, 50);
        return () => clearTimeout(timer);
    }, [leaderboardOpen, scheduleRedraw]);

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

    // --- Particle burst system ---
    const runBurstLoop = useCallback(() => {
        const canvas = burstCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const { w, h } = canvasSizeRef.current;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        burstParticlesRef.current = burstParticlesRef.current.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2;  // gravity
            p.vx *= 0.97;
            p.alpha -= 0.022;
            if (p.alpha <= 0) return false;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
            return true;
        });
        ctx.globalAlpha = 1;

        if (burstParticlesRef.current.length > 0) {
            burstRafRef.current = requestAnimationFrame(runBurstLoop);
        } else {
            burstRafRef.current = null;
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const triggerBurst = useCallback((screenX, screenY, count = 8) => {
        const newParticles = Array.from({ length: count }, (_, i) => {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
            const speed = 2.5 + Math.random() * 5;
            return {
                x: screenX, y: screenY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                r: 2 + Math.random() * 3.5,
                alpha: 0.85 + Math.random() * 0.15,
                color: BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)],
            };
        });
        burstParticlesRef.current.push(...newParticles);
        if (!burstRafRef.current) {
            burstRafRef.current = requestAnimationFrame(runBurstLoop);
        }
    }, [runBurstLoop]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // --- Cinematic zoom-to-purchase (3-phase: zoom-out + pan → zoom-in easeOutExpo) ---
    const panToPurchase = useCallback((purchaseId) => {
        if (!ownedPixels || !purchaseId) return;
        const purchasePixels = ownedPixels.filter(p => p.purchaseId === purchaseId || p.ownerId === purchaseId || p.brandId === purchaseId);
        if (purchasePixels.length === 0) return;

        const xs = purchasePixels.map(p => p.x);
        const ys = purchasePixels.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const bw = maxX - minX + 1, bh = maxY - minY + 1;
        const centerX = minX + bw / 2, centerY = minY + bh / 2;

        const { w, h } = canvasSize;
        const padding = 2.5;
        const endZoom = Math.min(MAX_ZOOM, Math.min(w / (bw * padding), h / (bh * padding)));

        const c = camera.current;
        const startZoom = c.zoom;
        const startX = c.x, startY = c.y;
        // Phase 1 zooms out to see more context, panning toward target
        const midZoom = Math.max(MIN_ZOOM, startZoom * 0.65);
        const midX = centerX - (w / midZoom) / 2;
        const midY = centerY - (h / midZoom) / 2;
        const endX = centerX - (w / endZoom) / 2;
        const endY = centerY - (h / endZoom) / 2;

        const easeOutExpo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
        const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        const PHASE1 = 260; // zoom-out + pan
        const PHASE2 = 490; // zoom-in easeOutExpo
        const TOTAL = PHASE1 + PHASE2;
        const t0 = performance.now();

        const animatePan = () => {
            const elapsed = performance.now() - t0;

            if (elapsed <= PHASE1) {
                const p = easeInOut(Math.min(1, elapsed / PHASE1));
                c.zoom = startZoom + (midZoom - startZoom) * p;
                c.x = startX + (midX - startX) * p;
                c.y = startY + (midY - startY) * p;
            } else {
                const p = easeOutExpo(Math.min(1, (elapsed - PHASE1) / PHASE2));
                c.zoom = midZoom + (endZoom - midZoom) * p;
                c.x = midX + (endX - midX) * p;
                c.y = midY + (endY - midY) * p;
            }

            targetZoom.current = c.zoom;
            clampCamera();
            setZoomDisplay(c.zoom);
            scheduleRedraw();

            if (elapsed < TOTAL) requestAnimationFrame(animatePan);
        };
        requestAnimationFrame(animatePan);
    }, [ownedPixels, canvasSize, clampCamera, scheduleRedraw]);

    // --- Global Command Event Listener ---
    useEffect(() => {
        const handler = (e) => {
            const purchaseId = e.detail;
            panToPurchase(purchaseId);
            // Also open brand focus card for the matched brand
            const matchedPixel = ownedPixels.find(
                p => p.purchaseId === purchaseId || p.ownerId === purchaseId || p.brandId === purchaseId
            );
            if (matchedPixel) setFocusedBrand(matchedPixel);
        };
        document.addEventListener('map:zoomToBrand', handler);
        return () => document.removeEventListener('map:zoomToBrand', handler);
    }, [panToPurchase, ownedPixels]);

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

        if (owner) {
            // Show brand focus card and zoom to this block
            setFocusedBrand(owner);
            panToPurchase(owner.purchaseId);
            return;
        }

        // Clicking empty space — close any open brand card
        setFocusedBrand(null);

        setIsDragging(true);
        isDraggingRef.current = true;
        setDragStart(pixel);
        setDragEnd(pixel);
        currentDragStart.current = pixel;
        currentDragEnd.current = pixel;
    }, [getPixelFromEvent, ownedMap, panToPurchase]);

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
                rawTooltipX.set(e.clientX);
                rawTooltipY.set(e.clientY);
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
            let didSelect = false;
            setSelectedPixels(prev => {
                const key = `${dragStart.x},${dragStart.y}`;
                if (isClick && getPixelState(dragStart.x, dragStart.y) === 'OWNED') return prev;

                if (isClick) {
                    const next = prev.has(key) ? new Set() : new Set([key]);
                    if (next.size > 0) didSelect = true;
                    return next;
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
                    didSelect = true;
                    return newSet;
                }
            });
            // Particle burst at the pixel's screen position on selection
            if (didSelect) {
                const px = dragStart.x + 0.5;
                const py = dragStart.y + 0.5;
                const sc = boardToScreen(px, py);
                triggerBurst(sc.x, sc.y, 8);
            }
        }
        setDragStart(null);
        setDragEnd(null);
        currentDragStart.current = null;
        currentDragEnd.current = null;
    }, [isDragging, dragStart, dragEnd, getPixelState, boardToScreen, triggerBurst]);

    const handleMouseLeave = useCallback(() => {
        if (hoveredKeyRef.current !== '') {
            hoveredKeyRef.current = '';
            setHoveredPixel(null);
        }
    }, []);

    // Double-click on owned pixel → open brand URL in new tab
    const handleDoubleClick = useCallback((e) => {
        const pixel = getPixelFromEvent(e);
        if (!pixel) return;
        const key = `${pixel.x},${pixel.y}`;
        const owner = ownedMap.get(key);
        if (owner?.ownerUrl) {
            const url = owner.ownerUrl.startsWith('http') ? owner.ownerUrl : `https://${owner.ownerUrl}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }, [getPixelFromEvent, ownedMap]);

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
        canvas.addEventListener('dblclick', handleDoubleClick);

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
            canvas.removeEventListener('dblclick', handleDoubleClick);
        };
    }, [handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, handleTouchStart, handleTouchMove, handleTouchEnd, handleDoubleClick]);

    const handleCheckoutClick = () => {
        if (!user) { setAuthModalOpen(true); return; }

        // Guard: reject if selection overlaps any owned pixel
        const overlapping = Array.from(selectedPixels).some(key => ownedMap.has(key));
        if (overlapping) {
            setToastMessage('Your selection overlaps owned pixels. Please reselect a free area.');
            setTimeout(() => setToastMessage(null), 4000);
            return;
        }

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
                // Confetti burst from viewport center
                const { w: vw, h: vh } = canvasSizeRef.current;
                triggerBurst(vw / 2, vh / 2, 30);
            }
        } catch (err) {
            queryClient.setQueryData(['pixels'], backupPixels);
            const timeoutError = err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '');
            const rawMessage = err?.response?.data?.message || '';
            const errorMessage = timeoutError
                ? 'Purchase request timed out after 30 seconds. Please try again.'
                : /pixels already taken/i.test(rawMessage)
                    ? 'Some pixels in your selection are already taken. Please choose a different area and try again.'
                    : (rawMessage || 'Purchase failed. Please try again.');
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
        <div id="board" className="absolute inset-0 w-full h-full overflow-hidden" style={{ background: 'transparent' }}>
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -20 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 text-white text-sm font-medium px-6 py-3 rounded-full shadow-2xl z-50 pointer-events-none"
                    >
                        {toastMessage}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Canvas viewport — left edge shifts right when leaderboard is open */}
            <div
                ref={containerRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    // Leaderboard: left-6 (24px) + w-[300px] = 324px right edge
                    left: leaderboardOpen ? 324 : 0,
                    transition: 'left 380ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    background: 'transparent',
                }}
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
                {/* Particle burst canvas — sits above overlay, pointer-events none */}
                <canvas
                    ref={burstCanvasRef}
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        zIndex: 50,
                    }}
                />
                {isLoading && (
                    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
                        <div className="flex flex-col items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
                            <span className="text-xs font-medium text-gray-500 tracking-wide">Loading canvas…</span>
                        </div>
                    </div>
                )}
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

            {/* Drag pixel count indicator */}
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

            {/* Hover tooltip — spring-physics premium glass card */}
            <AnimatePresence mode="wait">
                {hoveredPixel && (
                    <motion.div
                        key={hoveredPixel.isOwned ? `owned-${hoveredPixel.purchaseId}` : `free-${hoveredPixel.x}-${hoveredPixel.y}`}
                        initial={{ opacity: 0, scale: 0.88, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: 6 }}
                        transition={{ type: 'spring', damping: 24, stiffness: 420, mass: 0.5 }}
                        className="fixed z-[9999] pointer-events-none"
                        style={{
                            x: smartTooltipX,
                            y: smartTooltipY,
                        }}
                    >
                        {!hoveredPixel.isOwned ? (
                            <div className="bg-white/95 backdrop-blur-xl rounded-2xl px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/60 flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="font-mono text-[11px] text-gray-400 tracking-tight">{hoveredPixel.x}, {hoveredPixel.y}</span>
                                <span className="w-px h-3 bg-gray-200" />
                                <span className="text-xs font-semibold text-emerald-600">Available</span>
                            </div>
                        ) : (
                            <div
                                className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.14)] border border-white/60 overflow-hidden"
                                style={{ minWidth: 240, maxWidth: 300 }}
                            >
                                {/* Header accent bar */}
                                <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-400" />

                                <div className="p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        {/* Logo */}
                                        <div
                                            className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden border border-black/08 shadow-sm flex items-center justify-center text-white text-xs font-bold"
                                            style={{ backgroundColor: '#6366f1' }}
                                        >
                                            {hoveredPixel.logoUrl ? (
                                                <img
                                                    crossOrigin="anonymous"
                                                    src={resolveLogoUrlUtil(hoveredPixel.logoUrl)}
                                                    alt={hoveredPixel.ownerName}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            ) : (
                                                (hoveredPixel.ownerName || '?').slice(0, 2).toUpperCase()
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 text-[15px] leading-tight truncate">
                                                {hoveredPixel.ownerName || 'Claimed Space'}
                                            </p>
                                            {hoveredPixel.ownerUrl && (
                                                <p className="text-[11px] text-indigo-500 font-medium truncate mt-0.5">
                                                    {getDomain(hoveredPixel.ownerUrl)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Pixels</p>
                                            <p className="text-sm font-bold text-gray-900 font-mono">{(hoveredPixel.ownerPixelCount || 1).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Rank</p>
                                            <p className="text-sm font-bold text-gray-900">#{hoveredPixel.ownerRank || '–'}</p>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                                        <span className="text-[10px] font-mono text-gray-400">{hoveredPixel.x}, {hoveredPixel.y}</span>
                                        <span className="text-[11px] font-semibold text-indigo-500 flex items-center gap-1">
                                            Double-click to visit
                                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path d="M1 8L8 1M8 1H3M8 1v5"/>
                                            </svg>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Selection action bar */}
            {selectedPixels.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] animate-slide-in">
                    <div className="glass-card shadow-2xl px-6 py-4 rounded-2xl flex items-center gap-6 border border-[var(--color-border-subtle)] bg-white/80">
                        <div className="flex flex-col gap-0.5">
                            <p className="text-xs font-medium text-gray-500">
                                <span className="font-bold text-[var(--color-text-primary)]">{selectedPixels.size}</span> pixels selected
                            </p>
                        </div>
                        <div className="w-px h-10 bg-[var(--color-border-subtle)]"></div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setSelectedPixels(new Set())} className="text-xs font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">Cancel</button>
                            <Button onClick={handleCheckoutClick} className="bg-[var(--color-accent)] text-white px-6 py-2.5 rounded-xl text-sm transition shadow-none hover:bg-blue-700">
                                Secure Pixels
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Floating Map Controls HUD */}
            <div className="absolute right-6 bottom-6 flex flex-col items-end gap-3 pointer-events-none z-40">
                <div className="flex items-center gap-2 pointer-events-auto">
                    <div className="glass-card flex items-center gap-1 p-1 rounded-[12px] bg-white/70 border border-[var(--color-border-subtle)]">
                        <button onClick={() => updateTargetZoom(camera.current.zoom * 0.7)} className="w-8 h-8 flex items-center justify-center rounded-[8px] text-sm hover:bg-white/80 transition-colors">−</button>
                        <button onClick={() => fitToViewport()} className="px-2 h-8 flex items-center justify-center rounded-[8px] text-[11px] font-semibold hover:bg-white/80 transition-colors w-12">{zoomPercent}%</button>
                        <button onClick={() => updateTargetZoom(camera.current.zoom * 1.4)} className="w-8 h-8 flex items-center justify-center rounded-[8px] text-sm hover:bg-white/80 transition-colors">+</button>
                    </div>
                    <button
                        onClick={() => setHeatmapVisible(v => !v)}
                        className={`glass-card p-2 rounded-[12px] transition border border-[var(--color-border-subtle)] bg-white/70 ${heatmapVisible ? 'text-green-600 border-green-500/30' : 'text-[var(--color-text-secondary)] hover:text-black'}`}
                        title="Toggle heatmap overlay"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 20h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1z"></path>
                            <path d="M12 4v16"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
            <PurchaseModal
                key={purchaseKey} isOpen={purchaseModalOpen} onClose={() => { setPurchaseModalOpen(false); setPurchaseError(''); }}
                onSubmit={handlePurchase} selectedCount={selectedPixels.size} pricePerPixel={100} isPurchasing={isProcessing}
                purchaseError={purchaseError} setPurchaseError={setPurchaseError} uploadProgress={uploadProgress}
            />

            {/* Brand Focus Mode — dim overlay */}
            <AnimatePresence>
                {focusedBrand && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: 'rgba(0,0,0,0.12)' }}
                    />
                )}
            </AnimatePresence>

            {/* Brand Focus Mode — brand card */}
            <AnimatePresence>
                {focusedBrand && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.97 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 340, mass: 0.7 }}
                        className="absolute bottom-28 left-1/2 z-[80] pointer-events-auto"
                        style={{ transform: 'translateX(-50%)', width: 'min(400px, 90vw)' }}
                    >
                        <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-4 relative" onClick={e => e.stopPropagation()}>
                            {/* Close button */}
                            <button
                                onClick={() => { setFocusedBrand(null); fitToViewport(); }}
                                className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 1l10 10M11 1L1 11"/>
                                </svg>
                            </button>

                            {/* Logo */}
                            <div
                                className="w-12 h-12 rounded-full flex-shrink-0 border border-black/08 shadow-sm overflow-hidden flex items-center justify-center text-white font-bold text-sm"
                                style={{ backgroundColor: '#6366f1' }}
                            >
                                {focusedBrand.logoUrl ? (
                                    <img
                                        crossOrigin="anonymous"
                                        src={resolveLogoUrlUtil(focusedBrand.logoUrl)}
                                        alt={focusedBrand.ownerName}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                ) : (
                                    (focusedBrand.ownerName || '?').slice(0, 2).toUpperCase()
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-[var(--color-text-primary)] text-base truncate leading-tight">
                                    {focusedBrand.ownerName || 'Brand'}
                                </p>
                                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                                    {(focusedBrand.ownerPixelCount || focusedBrand.blockArea || 1).toLocaleString()} pixels owned
                                </p>
                            </div>

                            {/* Visit button */}
                            {focusedBrand.ownerUrl && (
                                <a
                                    href={focusedBrand.ownerUrl.startsWith('http') ? focusedBrand.ownerUrl : `https://${focusedBrand.ownerUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0 px-3.5 py-2 bg-black text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-1.5"
                                >
                                    Visit
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M1 9L9 1M9 1H3M9 1v6"/>
                                    </svg>
                                </a>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
