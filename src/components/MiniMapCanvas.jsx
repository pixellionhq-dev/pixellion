import { useRef, useEffect, useCallback } from 'react';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../constants/canvasConfig';

const MAP_SIZE = 160;       // mini-map is 160×160 CSS px
const PADDING = 6;          // internal padding
const BG = '#ffffff';
const BORDER_COLOR = 'rgba(0,0,0,0.12)';
const VIEWPORT_FILL = 'rgba(59, 130, 246, 0.15)';
const VIEWPORT_STROKE = 'rgba(59, 130, 246, 0.7)';
const PIXEL_FILL = 'rgba(0,0,0,0.35)';

/**
 * MiniMapCanvas — small overview of the entire board, shown in the
 * bottom-right corner of the canvas container.
 *
 * Props:
 *   camera        – ref to { x, y, zoom }
 *   canvasSize    – { w, h } of main viewport
 *   ownedPixels   – array of { x, y, purchaseId, ownerId, color, ... }
 *   onNavigate    – (boardX, boardY) => void
 *   zoomDisplay   – numeric zoom for re-render trigger
 *   cursorNear    – boolean, true when cursor is in the mini-map zone
 */
export default function MiniMapCanvas({ camera, canvasSize, ownedPixels, onNavigate, zoomDisplay, cursorNear }) {
    const canvasRef = useRef(null);
    const isDragging = useRef(false);
    const rafId = useRef(null);

    // Board → minimap coordinate scale
    const scale = (MAP_SIZE - PADDING * 2) / Math.max(BOARD_WIDTH, BOARD_HEIGHT);

    // --- Draw ---
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const size = MAP_SIZE;

        if (canvas.width !== size * dpr) {
            canvas.width = size * dpr;
            canvas.height = size * dpr;
            canvas.style.width = `${size}px`;
            canvas.style.height = `${size}px`;
            ctx.scale(dpr, dpr);
        }

        ctx.clearRect(0, 0, size, size);

        // Board background
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(PADDING, PADDING, BOARD_WIDTH * scale, BOARD_HEIGHT * scale);

        // Draw owned pixel blocks (simplified — group by purchaseId for perf)
        const groups = new Map();
        (ownedPixels || []).forEach(p => {
            const gid = p.purchaseId || p.ownerId;
            if (!groups.has(gid)) groups.set(gid, { color: p.color, pixels: [] });
            groups.get(gid).pixels.push(p);
        });

        groups.forEach(group => {
            const pixels = group.pixels;
            const xs = pixels.map(p => p.x);
            const ys = pixels.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const rx = PADDING + minX * scale;
            const ry = PADDING + minY * scale;
            const rw = (maxX - minX + 1) * scale;
            const rh = (maxY - minY + 1) * scale;

            ctx.fillStyle = group.color || PIXEL_FILL;
            ctx.fillRect(rx, ry, Math.max(rw, 1), Math.max(rh, 1));
        });

        // Board outline
        ctx.strokeStyle = BORDER_COLOR;
        ctx.lineWidth = 1;
        ctx.strokeRect(PADDING, PADDING, BOARD_WIDTH * scale, BOARD_HEIGHT * scale);

        // Subtle grid (every 100 cells)
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let i = 100; i < BOARD_WIDTH; i += 100) {
            const x = PADDING + i * scale;
            ctx.moveTo(x, PADDING);
            ctx.lineTo(x, PADDING + BOARD_HEIGHT * scale);
        }
        for (let i = 100; i < BOARD_HEIGHT; i += 100) {
            const y = PADDING + i * scale;
            ctx.moveTo(PADDING, y);
            ctx.lineTo(PADDING + BOARD_WIDTH * scale, y);
        }
        ctx.stroke();

        // Viewport rectangle
        const c = camera.current;
        const { w, h } = canvasSize;
        const viewW = w / c.zoom;
        const viewH = h / c.zoom;

        const vx = PADDING + c.x * scale;
        const vy = PADDING + c.y * scale;
        const vw = viewW * scale;
        const vh = viewH * scale;

        // Clamp to board area for drawing
        const cx = Math.max(PADDING, vx);
        const cy = Math.max(PADDING, vy);
        const cw = Math.min(vw, PADDING + BOARD_WIDTH * scale - cx);
        const ch = Math.min(vh, PADDING + BOARD_HEIGHT * scale - cy);

        ctx.fillStyle = VIEWPORT_FILL;
        ctx.fillRect(cx, cy, cw, ch);
        ctx.strokeStyle = VIEWPORT_STROKE;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx, cy, cw, ch);
    }, [ownedPixels, canvasSize, camera, scale]);

    // Re-draw whenever zoom/pan changes (zoomDisplay is the trigger)
    useEffect(() => {
        if (rafId.current) cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(draw);
        return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
    }, [draw, zoomDisplay]);

    // --- Click / drag to navigate ---
    const mapToBoard = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const boardX = (mx - PADDING) / scale;
        const boardY = (my - PADDING) / scale;

        // Clamp to board
        return {
            x: Math.max(0, Math.min(BOARD_WIDTH, boardX)),
            y: Math.max(0, Math.min(BOARD_HEIGHT, boardY))
        };
    }, [scale]);

    const handlePointerDown = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        e.target.setPointerCapture(e.pointerId);
        isDragging.current = true;

        const point = mapToBoard(e);
        if (point && onNavigate) onNavigate(point.x, point.y);
    }, [mapToBoard, onNavigate]);

    const handlePointerMove = useCallback((e) => {
        if (!isDragging.current) return;
        e.preventDefault();
        e.stopPropagation();

        const point = mapToBoard(e);
        if (point && onNavigate) onNavigate(point.x, point.y);
    }, [mapToBoard, onNavigate]);

    const handlePointerUp = useCallback((e) => {
        e.target.releasePointerCapture(e.pointerId);
        isDragging.current = false;
    }, []);

    // When cursorNear is true and we're not actively dragging the minimap,
    // fade out and let pointer events pass through to the board underneath
    const hidden = cursorNear && !isDragging.current;

    return (
        <div
            style={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                width: MAP_SIZE,
                height: MAP_SIZE,
                background: BG,
                borderRadius: 10,
                boxShadow: hidden
                    ? 'none'
                    : '0 2px 16px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)',
                zIndex: 20,
                overflow: 'hidden',
                cursor: hidden ? 'default' : 'pointer',
                opacity: hidden ? 0.15 : 0.92,
                pointerEvents: hidden ? 'none' : 'auto',
                transition: 'opacity 0.25s ease, box-shadow 0.25s ease',
            }}
        >
            <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{
                    width: MAP_SIZE,
                    height: MAP_SIZE,
                    display: 'block',
                    touchAction: 'none',
                }}
            />
        </div>
    );
}
