import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

// ── Config ────────────────────────────────────────────────────────────────────
const COLORS = ['#0066CC', '#FF3B30', '#34C759', '#FF9500'];
const NUM_PARTICLES = 200;
const PUSH_RADIUS = 150;
const SESSION_KEY = 'px_hero_seen';

function makeParticles(W, H) {
    const cx = W / 2;
    const cy = H / 2;
    return Array.from({ length: NUM_PARTICLES }, () => {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const dx = x - cx || 0.001;
        const dy = y - cy || 0.001;
        const d  = Math.sqrt(dx * dx + dy * dy);
        const spd = 0.3 + Math.random() * 0.5;
        return {
            x, y,
            vx: (dx / d) * spd,
            vy: (dy / d) * spd,
            r:  1.5 + Math.random() * 1.5,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
        };
    });
}

export default function HeroOverlay({ onDismiss }) {
    const canvasRef    = useRef(null);
    const particlesRef = useRef([]);
    const mouseRef     = useRef({ x: -9999, y: -9999 });
    const tiltCur      = useRef({ x: 0, y: 0 });
    const tiltTarget   = useRef({ x: 0, y: 0 });
    const rafCanvasRef = useRef(null);
    const rafTiltRef   = useRef(null);

    const [tilt,    setTilt]    = useState({ x: 0, y: 0 });
    const [glowX,   setGlowX]   = useState('50%');
    const [glowY,   setGlowY]   = useState('50%');
    const [exiting, setExiting] = useState(false);

    // ── Dismiss ───────────────────────────────────────────────────────────────
    const dismiss = useCallback(() => {
        setExiting(true);
        sessionStorage.setItem(SESSION_KEY, '1');
        setTimeout(() => onDismiss?.(), 520);
    }, [onDismiss]);

    // ── Particle canvas ───────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let W = window.innerWidth;
        let H = window.innerHeight;

        const resize = () => {
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width  = W;
            canvas.height = H;
            particlesRef.current = makeParticles(W, H);
        };
        resize();
        window.addEventListener('resize', resize);

        const loop = () => {
            ctx.clearRect(0, 0, W, H);
            const mx = mouseRef.current.x;
            const my = mouseRef.current.y;

            for (const p of particlesRef.current) {
                // Mouse repulsion
                const dx = p.x - mx;
                const dy = p.y - my;
                const d2 = dx * dx + dy * dy;
                if (d2 < PUSH_RADIUS * PUSH_RADIUS && d2 > 0) {
                    const d   = Math.sqrt(d2);
                    const f   = (PUSH_RADIUS - d) / PUSH_RADIUS;
                    p.vx += (dx / d) * f * 0.5;
                    p.vy += (dy / d) * f * 0.5;
                }
                // Damping + drift back toward steady velocity
                p.vx *= 0.97;
                p.vy *= 0.97;
                p.x  += p.vx;
                p.y  += p.vy;
                // Wrap edges
                if (p.x < -p.r) p.x = W + p.r;
                else if (p.x > W + p.r) p.x = -p.r;
                if (p.y < -p.r) p.y = H + p.r;
                else if (p.y > H + p.r) p.y = -p.r;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = 0.5;
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            rafCanvasRef.current = requestAnimationFrame(loop);
        };
        rafCanvasRef.current = requestAnimationFrame(loop);

        return () => {
            window.removeEventListener('resize', resize);
            if (rafCanvasRef.current) cancelAnimationFrame(rafCanvasRef.current);
        };
    }, []);

    // ── Mouse tracking ────────────────────────────────────────────────────────
    useEffect(() => {
        const onMove = (e) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
            const cx = window.innerWidth  / 2;
            const cy = window.innerHeight / 2;
            tiltTarget.current = {
                x: ((e.clientY - cy) / cy) * 10,
                y: ((e.clientX - cx) / cx) * 10,
            };
            setGlowX(`${e.clientX}px`);
            setGlowY(`${e.clientY}px`);
        };
        window.addEventListener('mousemove', onMove);
        return () => window.removeEventListener('mousemove', onMove);
    }, []);

    // ── Tilt spring loop ──────────────────────────────────────────────────────
    useEffect(() => {
        const loop = () => {
            tiltCur.current.x += (tiltTarget.current.x - tiltCur.current.x) * 0.08;
            tiltCur.current.y += (tiltTarget.current.y - tiltCur.current.y) * 0.08;
            setTilt({ x: tiltCur.current.x, y: tiltCur.current.y });
            rafTiltRef.current = requestAnimationFrame(loop);
        };
        rafTiltRef.current = requestAnimationFrame(loop);
        return () => { if (rafTiltRef.current) cancelAnimationFrame(rafTiltRef.current); };
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: exiting ? 0 : 1 }}
            transition={{ duration: 0.52, ease: 'easeOut' }}
            className="fixed inset-0 flex items-center justify-center select-none"
            style={{
                zIndex: 300,
                backgroundColor: 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(2px)',
                WebkitBackdropFilter: 'blur(2px)',
            }}
        >
            {/* Particle canvas — behind everything */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{ width: '100%', height: '100%' }}
            />

            {/* Mouse glow radial gradient */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `radial-gradient(700px circle at ${glowX} ${glowY}, rgba(0,102,204,0.07) 0%, transparent 65%)`,
                }}
            />

            {/* Centre content */}
            <div className="relative z-10 flex flex-col items-center text-center px-6">

                {/* 3-D tilting title */}
                <div
                    style={{
                        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                        transformStyle: 'preserve-3d',
                        willChange: 'transform',
                    }}
                >
                    {/* Subtle shadow copy behind title for depth */}
                    <h1
                        aria-hidden="true"
                        style={{
                            fontSize: 'clamp(64px, 10vw, 120px)',
                            fontWeight: 700,
                            letterSpacing: '-0.04em',
                            color: 'rgba(0,0,0,0.04)',
                            lineHeight: 1,
                            fontFamily: '-apple-system, "SF Pro Display", BlinkMacSystemFont, system-ui, sans-serif',
                            position: 'absolute',
                            top: 4,
                            left: 4,
                            userSelect: 'none',
                            pointerEvents: 'none',
                        }}
                    >
                        Pixellion
                    </h1>
                    <h1
                        style={{
                            fontSize: 'clamp(64px, 10vw, 120px)',
                            fontWeight: 700,
                            letterSpacing: '-0.04em',
                            color: '#000000',
                            lineHeight: 1,
                            fontFamily: '-apple-system, "SF Pro Display", BlinkMacSystemFont, system-ui, sans-serif',
                            position: 'relative',
                            margin: 0,
                        }}
                    >
                        Pixellion
                    </h1>
                </div>

                {/* Subtitle */}
                <p
                    style={{
                        fontSize: 20,
                        color: '#6E6E73',
                        fontWeight: 400,
                        marginTop: 28,
                        letterSpacing: '-0.01em',
                    }}
                >
                    Own your place on the internet.
                </p>

                {/* CTA buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
                    <button
                        onClick={dismiss}
                        className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold rounded-full transition-all duration-200 hover:scale-[1.04] active:scale-[0.97] shadow-[0_4px_24px_rgba(0,0,0,0.18)]"
                        style={{ backgroundColor: '#000', color: '#fff', minWidth: 220 }}
                    >
                        Claim Your Pixels →
                    </button>
                    <button
                        onClick={dismiss}
                        className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold rounded-full transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
                        style={{
                            backgroundColor: 'transparent',
                            color: '#000',
                            border: '2px solid rgba(0,0,0,0.14)',
                            minWidth: 200,
                        }}
                    >
                        Explore the Board
                    </button>
                </div>

                {/* Subtext */}
                <p
                    className="mt-10 text-xs tracking-widest uppercase"
                    style={{ color: '#B0B0B5', letterSpacing: '0.12em' }}
                >
                    1,000 × 1,000 pixels · Own a piece of the internet
                </p>
            </div>
        </motion.div>
    );
}
