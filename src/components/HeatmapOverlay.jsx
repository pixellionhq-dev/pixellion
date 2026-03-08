import { useRef, useEffect, useCallback } from 'react';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../constants/canvasConfig';

/**
 * HeatmapOverlay — renders a semi-transparent density heatmap
 * over the board showing pixel ownership concentration.
 *
 * Props:
 *   camera       – ref to { x, y, zoom }
 *   canvasSize   – { w, h }
 *   ownedPixels  – array of pixels
 *   visible      – boolean toggle
 */
export default function HeatmapOverlay({ camera, canvasSize, ownedPixels, visible }) {
    const canvasRef = useRef(null);
    const rafId = useRef(null);

    // Build density grid (100x100 zones of 10x10 cells)
    const densityGrid = useCallback(() => {
        const ZONE = 10; // 10x10 pixel zones
        const cols = Math.ceil(BOARD_WIDTH / ZONE);
        const rows = Math.ceil(BOARD_HEIGHT / ZONE);
        const grid = new Float32Array(cols * rows);
        let maxDensity = 0;

        (ownedPixels || []).forEach(p => {
            const col = Math.floor(p.x / ZONE);
            const row = Math.floor(p.y / ZONE);
            if (col >= 0 && col < cols && row >= 0 && row < rows) {
                const idx = row * cols + col;
                grid[idx]++;
                if (grid[idx] > maxDensity) maxDensity = grid[idx];
            }
        });

        return { grid, cols, rows, zone: ZONE, maxDensity };
    }, [ownedPixels]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !visible) return;

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

        const { grid, cols, rows, zone, maxDensity } = densityGrid();
        if (maxDensity === 0) return;

        const c = camera.current;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const density = grid[row * cols + col];
                if (density === 0) continue;

                const ratio = density / maxDensity;

                // Screen positions
                const sx = (col * zone - c.x) * c.zoom;
                const sy = (row * zone - c.y) * c.zoom;
                const sw = zone * c.zoom;
                const sh = zone * c.zoom;

                // Skip off-screen
                if (sx + sw < 0 || sy + sh < 0 || sx > w || sy > h) continue;

                // Color: green → yellow → red
                let r, g, b;
                if (ratio < 0.5) {
                    const t = ratio * 2;
                    r = Math.round(34 + (234 - 34) * t);
                    g = Math.round(197 - (197 - 179) * t);
                    b = Math.round(94 - (94 - 8) * t);
                } else {
                    const t = (ratio - 0.5) * 2;
                    r = Math.round(234 + (239 - 234) * t);
                    g = Math.round(179 - (179 - 68) * t);
                    b = Math.round(8 + (68 - 8) * t);
                }

                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.35)`;
                ctx.fillRect(sx, sy, sw, sh);
            }
        }
    }, [canvasSize, camera, visible, densityGrid]);

    useEffect(() => {
        if (!visible) {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            return;
        }
        if (rafId.current) cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(draw);
        return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
    }, [draw, visible]);

    if (!visible) return null;

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: canvasSize.w,
                height: canvasSize.h,
                pointerEvents: 'none',
                zIndex: 5,
            }}
        />
    );
}
