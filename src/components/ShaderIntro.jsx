import { useEffect, useRef, useState } from 'react';
import usePixelViewport from '../store/usePixelViewport';

const COLS = 60;
const ROWS = 60;
const DOT_R = 3;
const VORTEX_RADIUS = 200;
const CENTER_R = 120;
const FADE_OUT_START = 2200;
const FADE_OUT_DUR = 500;
const TOTAL_DUR = FADE_OUT_START + FADE_OUT_DUR;

export default function ShaderIntro({ onDone }) {
    const canvasRef = useRef(null);
    const { brands } = usePixelViewport();
    const brandsRef = useRef([]);
    const [visible, setVisible] = useState(true);

    // Keep brands ref current so the animation loop can read it dynamically
    useEffect(() => {
        brandsRef.current = brands || [];
    }, [brands]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let W = window.innerWidth;
        let H = window.innerHeight;

        const resize = () => {
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width = W;
            canvas.height = H;
        };
        resize();
        window.addEventListener('resize', resize);

        // Build dot grid with unique phase offsets
        const dots = [];
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                dots.push({ col, row, phase: Math.random() * Math.PI * 2 });
            }
        }

        const images = {};

        const getOrLoadImage = (url) => {
            if (!url) return null;
            if (!images[url]) {
                const img = new Image();
                img.src = url;
                images[url] = img;
            }
            return images[url];
        };

        const startTime = performance.now();
        let raf;

        const draw = (now) => {
            const elapsed = now - startTime;
            W = canvas.width;
            H = canvas.height;
            const cx = W / 2;
            const cy = H / 2;

            // Global fade-out alpha
            const globalAlpha = elapsed > FADE_OUT_START
                ? Math.max(0, 1 - (elapsed - FADE_OUT_START) / FADE_OUT_DUR)
                : 1;

            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = globalAlpha;

            const time = elapsed / 1000;
            const spX = W / COLS;
            const spY = H / ROWS;

            // --- Dot grid ---
            for (const dot of dots) {
                const baseX = (dot.col + 0.5) * spX;
                const baseY = (dot.row + 0.5) * spY;

                // Vortex pull toward center
                const dx = baseX - cx;
                const dy = baseY - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                let drawX = baseX;
                let drawY = baseY;
                if (dist < VORTEX_RADIUS && dist > 0) {
                    const force = Math.pow(1 - dist / VORTEX_RADIUS, 1.5) * 0.5;
                    drawX = baseX - dx * force;
                    drawY = baseY - dy * force;
                }

                // Skip dots inside center circle
                const ddx = drawX - cx;
                const ddy = drawY - cy;
                if (ddx * ddx + ddy * ddy < (CENTER_R + 10) * (CENTER_R + 10)) continue;

                const scale = 0.3 + 0.7 * Math.abs(Math.sin(time * 2 + dot.phase));
                const opacity = 0.2 + 0.8 * Math.abs(Math.sin(time * 1.5 + dot.phase));
                const r = DOT_R * scale;

                ctx.beginPath();
                ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(235,235,235,${opacity})`;
                ctx.fill();
            }

            // --- Center frosted glass circle (appears at 500ms) ---
            if (elapsed > 500) {
                const circleAlpha = Math.min(1, (elapsed - 500) / 300);

                ctx.save();
                ctx.globalAlpha = globalAlpha * circleAlpha;
                ctx.shadowBlur = 40;
                ctx.shadowColor = 'rgba(0,0,0,0.08)';
                ctx.beginPath();
                ctx.arc(cx, cy, CENTER_R, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.97)';
                ctx.fill();
                ctx.shadowBlur = 0;

                // Pixellion logo mark inside circle
                const logoAlpha = Math.min(1, (elapsed - 700) / 200);
                if (logoAlpha > 0) {
                    ctx.globalAlpha = globalAlpha * circleAlpha * logoAlpha;
                    const gs = 18; // grid square size
                    const gap = 4;
                    const total = gs * 2 + gap;
                    const ox = cx - total / 2;
                    const oy = cy - total / 2;
                    const rr = 3;

                    const squares = [
                        { x: ox,        y: oy,        a: 0.9 },
                        { x: ox+gs+gap, y: oy,        a: 0.5 },
                        { x: ox,        y: oy+gs+gap, a: 0.5 },
                        { x: ox+gs+gap, y: oy+gs+gap, a: 0.25 },
                    ];
                    for (const sq of squares) {
                        ctx.beginPath();
                        ctx.roundRect(sq.x, sq.y, gs, gs, rr);
                        ctx.fillStyle = `rgba(10,10,10,${sq.a})`;
                        ctx.fill();
                    }
                }

                ctx.restore();

                // --- Brand logo cycling (starts at 800ms) ---
                const logoUrls = brandsRef.current
                    .map(b => b.logoUrl)
                    .filter(Boolean)
                    .slice(0, 20);

                if (elapsed > 800 && logoUrls.length > 0) {
                    const logoElapsed = elapsed - 800;
                    const INTERVAL = 600;
                    const loopIndex = Math.floor(logoElapsed / INTERVAL);
                    const intraT = (logoElapsed % INTERVAL) / INTERVAL;
                    const FADE_IN_END = 0.7;
                    const crossFade = intraT > FADE_IN_END
                        ? (intraT - FADE_IN_END) / (1 - FADE_IN_END)
                        : 0;

                    const curUrl = logoUrls[loopIndex % logoUrls.length];
                    const nxtUrl = logoUrls[(loopIndex + 1) % logoUrls.length];
                    const curImg = getOrLoadImage(curUrl);
                    const nxtImg = getOrLoadImage(nxtUrl);

                    const logoSize = (CENTER_R - 20) * 1.2;
                    const lx = cx - logoSize / 2;
                    const ly = cy - logoSize / 2;
                    const fadeIn = Math.min(1, (elapsed - 800) / 200);
                    const baseA = globalAlpha * circleAlpha * fadeIn;

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, CENTER_R - 16, 0, Math.PI * 2);
                    ctx.clip();

                    if (curImg?.complete && curImg.naturalWidth > 0) {
                        ctx.globalAlpha = baseA * (1 - crossFade);
                        ctx.drawImage(curImg, lx, ly, logoSize, logoSize);
                    }
                    if (nxtImg?.complete && nxtImg.naturalWidth > 0 && crossFade > 0) {
                        ctx.globalAlpha = baseA * crossFade;
                        ctx.drawImage(nxtImg, lx, ly, logoSize, logoSize);
                    }

                    ctx.restore();
                }
            }

            ctx.globalAlpha = 1;

            if (elapsed < TOTAL_DUR) {
                raf = requestAnimationFrame(draw);
            } else {
                sessionStorage.setItem('px_intro_seen', '1');
                setVisible(false);
                onDone?.();
            }
        };

        raf = requestAnimationFrame(draw);

        return () => {
            window.removeEventListener('resize', resize);
            if (raf) cancelAnimationFrame(raf);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (!visible) return null;

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 9999,
                pointerEvents: 'none',
            }}
        />
    );
}
