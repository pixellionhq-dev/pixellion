import { useEffect, useRef, useState } from 'react';

// ─── Timeline ────────────────────────────────────────────────────────────────
const P1_END   = 800;   // dots appear
const P2_END   = 1800;  // spiral convergence
const P3_END   = 2300;  // bloom flash
const P4_END   = 2700;  // radial reveal / fade
const TOTAL    = P4_END;

const NUM_DOTS = 160;

function buildDots(W, H) {
    const cx = W / 2;
    const cy = H / 2;
    const diag = Math.sqrt(W * W + H * H);

    return Array.from({ length: NUM_DOTS }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist  = 80 + Math.random() * (diag * 0.47);
        const gray  = 140 + Math.floor(Math.random() * 80);
        return {
            startAngle:  angle,
            startDist:   dist,
            // static position used in Phase 1
            x: cx + Math.cos(angle) * dist,
            y: cy + Math.sin(angle) * dist,
            // staggered appearance delay 0–600 ms
            delay:       Math.random() * 600,
            maxR:        1 + Math.random() * 1.8,
            // pulse params
            phase:       Math.random() * Math.PI * 2,
            pulseFreq:   0.003 + Math.random() * 0.003,
            // spiral params
            spiralDir:   Math.random() < 0.5 ? 1 : -1,
            spiralSpeed: 0.6 + Math.random() * 1.2,
            color:       `rgb(${gray},${gray},${gray})`,
        };
    });
}

export default function ShaderIntro({ onDone }) {
    const canvasRef  = useRef(null);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let W = window.innerWidth;
        let H = window.innerHeight;
        let dots = null;

        const resize = () => {
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width  = W;
            canvas.height = H;
            dots = buildDots(W, H);
        };
        resize();
        window.addEventListener('resize', resize);

        const startTime = performance.now();
        let raf;

        const draw = (now) => {
            const elapsed = now - startTime;
            if (elapsed >= TOTAL) {
                // Done — clean up
                ctx.clearRect(0, 0, W, H);
                sessionStorage.setItem('px_intro_seen', '1');
                setVisible(false);
                onDone?.();
                return;
            }

            const cx = W / 2;
            const cy = H / 2;

            // ── White base ────────────────────────────────────────────────
            ctx.globalAlpha = 1;
            ctx.fillStyle   = '#ffffff';
            ctx.fillRect(0, 0, W, H);

            // ─────────────────────────────────────────────────────────────
            // PHASE 1  (0 → 800 ms): dots pop in across screen
            // ─────────────────────────────────────────────────────────────
            if (elapsed < P1_END) {
                for (const dot of dots) {
                    if (elapsed < dot.delay) continue;
                    const pct   = Math.min(1, (elapsed - dot.delay) / 200);
                    const pulse = 0.55 + 0.45 * Math.sin(elapsed * dot.pulseFreq + dot.phase);
                    const r     = dot.maxR * pct;
                    ctx.globalAlpha = pct * 0.75 * pulse;
                    ctx.beginPath();
                    ctx.arc(dot.x, dot.y, Math.max(0.4, r), 0, Math.PI * 2);
                    ctx.fillStyle = dot.color;
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }

            // ─────────────────────────────────────────────────────────────
            // PHASE 2  (800 → 1800 ms): dots spiral toward center
            // ─────────────────────────────────────────────────────────────
            if (elapsed >= P1_END && elapsed < P2_END) {
                const t2     = (elapsed - P1_END) / (P2_END - P1_END); // 0→1
                // ease-out cubic: fast start, slow landing
                const eased  = 1 - Math.pow(1 - t2, 3);

                for (const dot of dots) {
                    const currentDist  = dot.startDist * (1 - eased);
                    const spiralAngle  = dot.startAngle
                        + dot.spiralDir * dot.spiralSpeed * t2 * Math.PI * 2;
                    const dx = Math.cos(spiralAngle) * currentDist;
                    const dy = Math.sin(spiralAngle) * currentDist;
                    const r  = Math.max(0.3, dot.maxR * (1 - eased * 0.85));
                    const alpha = (1 - eased) * 0.72;
                    if (alpha < 0.02) continue;

                    ctx.globalAlpha = alpha;
                    ctx.beginPath();
                    ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
                    ctx.fillStyle = dot.color;
                    ctx.fill();
                }

                // Center glow builds as dots converge (starts at t2 = 0.45)
                if (t2 > 0.45) {
                    const glowT = (t2 - 0.45) / 0.55; // 0→1
                    const glowR = 16 + glowT * 100;
                    const grad  = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
                    grad.addColorStop(0,   `rgba(230,230,255,${glowT * 0.85})`);
                    grad.addColorStop(0.5, `rgba(220,220,255,${glowT * 0.4})`);
                    grad.addColorStop(1,   'rgba(255,255,255,0)');
                    ctx.globalAlpha = 1;
                    ctx.fillStyle   = grad;
                    ctx.beginPath();
                    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.globalAlpha = 1;
            }

            // ─────────────────────────────────────────────────────────────
            // PHASE 3  (1800 → 2300 ms): bloom flash expands to fill screen
            // ─────────────────────────────────────────────────────────────
            if (elapsed >= P2_END && elapsed < P3_END) {
                const t3    = (elapsed - P2_END) / (P3_END - P2_END); // 0→1
                const maxR  = Math.sqrt(W * W + H * H);

                // Bloom ring expands with ease-in then covers full screen
                const bloomR = maxR * Math.pow(t3, 0.55);

                // Inner core stays solid white; outer edge fades
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, bloomR));
                grad.addColorStop(0,   'rgba(255,255,255,1)');
                grad.addColorStop(0.6, 'rgba(255,255,255,1)');
                grad.addColorStop(1,   'rgba(255,255,255,0)');

                ctx.globalAlpha = 1;
                ctx.fillStyle   = grad;
                ctx.fillRect(0, 0, W, H);

                // Once bloom covers everything, solid white fill (no leak)
                if (t3 > 0.85) {
                    const coverAlpha = (t3 - 0.85) / 0.15;
                    ctx.globalAlpha  = coverAlpha;
                    ctx.fillStyle    = '#ffffff';
                    ctx.fillRect(0, 0, W, H);
                }
                ctx.globalAlpha = 1;
            }

            // ─────────────────────────────────────────────────────────────
            // PHASE 4  (2300 → 2700 ms): radial reveal — hole expands from center
            // White rectangle with growing circular cutout, revealing canvas beneath
            // ─────────────────────────────────────────────────────────────
            if (elapsed >= P3_END && elapsed < P4_END) {
                const t4    = (elapsed - P3_END) / (P4_END - P3_END); // 0→1
                const eased = Math.pow(t4, 0.6);                       // ease-in expand
                const holeR = Math.sqrt(W * W + H * H) * eased;

                ctx.globalAlpha = 1;
                ctx.fillStyle   = '#ffffff';
                ctx.beginPath();
                // Outer rectangle (full canvas)
                ctx.rect(0, 0, W, H);
                // Inner circle (counter-clockwise = hole)
                ctx.arc(cx, cy, Math.max(0, holeR), 0, Math.PI * 2, true);
                ctx.fill();

                // Soft edge: subtle vignette ring at the reveal boundary
                if (holeR > 10) {
                    const edgeW = holeR * 0.12;
                    const vig   = ctx.createRadialGradient(cx, cy, holeR - edgeW, cx, cy, holeR);
                    vig.addColorStop(0,   'rgba(255,255,255,0)');
                    vig.addColorStop(1,   'rgba(255,255,255,0.4)');
                    ctx.globalAlpha = 1 - t4;
                    ctx.fillStyle   = vig;
                    ctx.beginPath();
                    ctx.arc(cx, cy, holeR, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.globalAlpha = 1;
            }

            raf = requestAnimationFrame(draw);
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
