import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStats } from '../hooks/useBuyers';
import usePixelViewport from '../store/usePixelViewport';
import { useAuth } from '../hooks/useAuth';
import AuthModal from './AuthModal';

// ── Config ─────────────────────────────────────────────────────────────────
const NUM_PARTICLES = 400;
const PUSH_RADIUS   = 200;
const TAGLINES = [
    '1,000,000 pixels. Infinite possibilities.',
    "The world's most competitive digital billboard.",
    'Brands that own pixels, own attention.',
    'Your brand, rendered forever on the grid.',
];
const FEATURES = [
    {
        symbol: '⊞',
        title:  'Buy Pixels',
        desc:   'Select any area on our 1,000 × 1,000 grid. Choose your size, upload your logo.',
    },
    {
        symbol: '◎',
        title:  'Upload Your Brand',
        desc:   'Add your logo, website URL, and colour. It renders instantly.',
    },
    {
        symbol: '◈',
        title:  'Own the Leaderboard',
        desc:   'The more territory you hold, the higher you rank. Compete.',
    },
];

// ── Particle factory — floating pixel squares ───────────────────────────────
function makeParticles(W, H) {
    return Array.from({ length: NUM_PARTICLES }, () => {
        // 2x faster than before
        const speed = (0.06 + Math.random() * 0.22) * 2;
        const angle = Math.random() * Math.PI * 2;
        const baseVx = Math.cos(angle) * speed;
        const baseVy = Math.sin(angle) * speed;
        // Varied pixel sizes: 2x2, 4x4, or 6x6
        const sizeRoll = Math.random();
        const size = sizeRoll < 0.4 ? 2 : sizeRoll < 0.8 ? 4 : 6;
        // ~20% blue accent pixels, rest monochrome
        const isBlue = Math.random() < 0.20;
        const alpha = isBlue
            ? 0.30
            : 0.20 + Math.random() * 0.20; // 0.20–0.40
        return {
            x: Math.random() * W,
            y: Math.random() * H,
            vx: baseVx, vy: baseVy, baseVx, baseVy,
            size,
            isBlue,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.018,
            alpha,
        };
    });
}

// ── Count-up hook ───────────────────────────────────────────────────────────
function useCountUp(target, { duration = 1400, delay = 0, enabled = true } = {}) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!target || !enabled) return;
        let raf;
        const t0 = performance.now() + delay;
        const ease = t => 1 - Math.pow(1 - t, 3);
        const tick = now => {
            if (now < t0) { raf = requestAnimationFrame(tick); return; }
            const t = Math.min(1, (now - t0) / duration);
            setValue(Math.round(ease(t) * target));
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration, delay, enabled]);
    return value;
}

// ── StatItem ────────────────────────────────────────────────────────────────
function StatItem({ value, label, isAccent }) {
    return (
        <div className="flex flex-col items-center gap-1.5">
            <span
                style={{
                    fontSize: 'clamp(22px, 3vw, 30px)',
                    fontWeight: 700,
                    letterSpacing: '-0.035em',
                    lineHeight: 1,
                    color: isAccent ? '#0066CC' : '#000',
                }}
            >
                {value}
            </span>
            <span className="text-[11px] font-medium text-black/35 tracking-tight text-center">
                {label}
            </span>
        </div>
    );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function HeroOverlay({ onDismiss }) {
    const canvasRef    = useRef(null);
    const particlesRef = useRef([]);
    const mouseRef     = useRef({ x: -9999, y: -9999 });
    const animRafRef   = useRef(null);

    const [taglineIdx,     setTaglineIdx]     = useState(0);
    const [taglineVisible, setTaglineVisible] = useState(true);
    const [exiting,        setExiting]        = useState(false);
    const [authOpen,       setAuthOpen]       = useState(false);
    const [statsReady,     setStatsReady]     = useState(false);

    const { data: stats }  = useStats();
    const { brands }       = usePixelViewport();
    const { user }         = useAuth();

    // Deduplicate brands for social proof
    const uniqueBrands = useMemo(() => {
        if (!brands) return [];
        const seen = new Set();
        return brands.filter(b => {
            if (!b.brandId || seen.has(b.brandId)) return false;
            seen.add(b.brandId);
            return true;
        });
    }, [brands]);

    // Count-up animations
    const pixelCountAnim = useCountUp(stats?.totalPixelsSold ?? 0, { delay: 700, enabled: statsReady });
    const brandCountAnim = useCountUp(uniqueBrands.length,          { delay: 900, duration: 800, enabled: statsReady && uniqueBrands.length > 0 });

    useEffect(() => { if (stats) setStatsReady(true); }, [stats]);

    // ── Particle canvas ─────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let W = window.innerWidth, H = window.innerHeight;

        const resize = () => {
            W = window.innerWidth; H = window.innerHeight;
            canvas.width = W; canvas.height = H;
            particlesRef.current = makeParticles(W, H);
        };
        resize();
        window.addEventListener('resize', resize);

        const loop = () => {
            ctx.clearRect(0, 0, W, H);
            const mx = mouseRef.current.x;
            const my = mouseRef.current.y;

            for (const p of particlesRef.current) {
                // Repulsion: force = 800 / d²
                const dx = p.x - mx, dy = p.y - my;
                const d2 = dx * dx + dy * dy;
                if (d2 < PUSH_RADIUS * PUSH_RADIUS && d2 > 4) {
                    const d = Math.sqrt(d2);
                    const f = Math.min(1.8, 800 / (d * d));
                    p.vx += (dx / d) * f * 0.013;
                    p.vy += (dy / d) * f * 0.013;
                }
                // Drift back toward base velocity
                p.vx += (p.baseVx - p.vx) * 0.022;
                p.vy += (p.baseVy - p.vy) * 0.022;
                p.vx *= 0.984; p.vy *= 0.984;
                p.x += p.vx;  p.y += p.vy;
                p.rotation += p.rotSpeed;
                if (p.x < -10) p.x = W + 10;
                else if (p.x > W + 10) p.x = -10;
                if (p.y < -10) p.y = H + 10;
                else if (p.y > H + 10) p.y = -10;

                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle   = p.isBlue ? 'rgba(0,102,204,1)' : '#000';
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            }
            animRafRef.current = requestAnimationFrame(loop);
        };
        animRafRef.current = requestAnimationFrame(loop);

        return () => {
            window.removeEventListener('resize', resize);
            if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
        };
    }, []);

    // Mouse tracking
    useEffect(() => {
        const onMove = e => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
        window.addEventListener('mousemove', onMove, { passive: true });
        return () => window.removeEventListener('mousemove', onMove);
    }, []);

    // Rotating taglines
    useEffect(() => {
        const id = setInterval(() => {
            setTaglineVisible(false);
            const t = setTimeout(() => {
                setTaglineIdx(i => (i + 1) % TAGLINES.length);
                setTaglineVisible(true);
            }, 360);
            return () => clearTimeout(t);
        }, 3600);
        return () => clearInterval(id);
    }, []);

    const dismiss = useCallback(() => {
        setExiting(true);
        setTimeout(() => onDismiss?.(), 530);
    }, [onDismiss]);

    return (
        <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: exiting ? 0 : 1 }}
            transition={{ duration: 0.53, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 overflow-y-auto overflow-x-hidden"
            style={{
                zIndex: 300,
                backgroundColor: '#ffffff',
                fontFamily: '-apple-system,"SF Pro Display",BlinkMacSystemFont,system-ui,sans-serif',
            }}
        >
            {/* Fixed particle canvas */}
            <canvas
                ref={canvasRef}
                style={{
                    position: 'fixed', inset: 0,
                    width: '100%', height: '100%',
                    zIndex: 0, pointerEvents: 'none',
                }}
            />

            {/* Soft blue radial accent */}
            <div
                style={{
                    position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
                    background: 'radial-gradient(ellipse 140% 65% at 50% -5%, rgba(0,102,204,0.055) 0%, transparent 55%)',
                }}
            />

            {/* Scrollable content layer */}
            <div className="relative z-10">

                {/* ── NAVBAR ───────────────────────────────────────── */}
                <motion.header
                    initial={{ opacity: 0, y: -14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="sticky top-0 z-20 flex items-center justify-between px-8 py-5"
                    style={{
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                    }}
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 bg-black rounded-[5px] grid grid-cols-2 grid-rows-2 p-[3px] gap-[1.5px] flex-shrink-0">
                            <span className="rounded-[1px] bg-white/90" />
                            <span className="rounded-[1px] bg-white/40" />
                            <span className="rounded-[1px] bg-white/40" />
                            <span className="rounded-[1px] bg-white/90" />
                        </div>
                        <span className="font-semibold text-[15px] tracking-tight text-black">Pixellion</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {user ? (
                            <span className="text-[13px] font-medium text-black/50">{user.username}</span>
                        ) : (
                            <button
                                onClick={() => setAuthOpen(true)}
                                className="text-[13px] font-medium text-black/55 hover:text-black transition-colors duration-150"
                            >
                                Sign In
                            </button>
                        )}
                        <button
                            onClick={dismiss}
                            className="text-[13px] font-semibold bg-black text-white px-5 py-2 rounded-full hover:bg-gray-800 active:scale-95 transition-all duration-150 shadow-sm"
                        >
                            Get Started
                        </button>
                    </div>
                </motion.header>

                {/* ── HERO ─────────────────────────────────────────── */}
                <section
                    className="relative flex flex-col items-center justify-center px-6 pt-14 pb-20"
                    style={{ minHeight: 'calc(100vh - 76px)' }}
                >
                    {/* Live badge */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.86 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                        className="mb-9 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur-sm"
                        style={{ border: '1px solid rgba(0,0,0,0.08)' }}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[12px] font-medium text-black/50 tracking-tight">
                            Live · 1,000 × 1,000 pixel grid
                        </span>
                    </motion.div>

                    {/* Headline — each line clips-up */}
                    <div className="text-center mb-7">
                        {[
                            { text: 'Own your place',   color: '#000',     delay: 0.27 },
                            { text: 'on the internet.', color: '#0066CC',  delay: 0.40 },
                        ].map(({ text, color, delay }, i) => (
                            <div key={i} style={{ overflow: 'hidden' }}>
                                <motion.h1
                                    initial={{ y: '108%' }}
                                    animate={{ y: 0 }}
                                    transition={{ delay, duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
                                    style={{
                                        fontSize: 'clamp(42px, 7.5vw, 96px)',
                                        fontWeight: 700,
                                        letterSpacing: '-0.04em',
                                        lineHeight: 1.05,
                                        color,
                                        margin: 0,
                                        display: 'block',
                                    }}
                                >
                                    {text}
                                </motion.h1>
                            </div>
                        ))}
                    </div>

                    {/* Rotating tagline */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.56, duration: 0.5 }}
                        className="mb-11 flex items-center justify-center"
                        style={{ height: 28 }}
                    >
                        <AnimatePresence mode="wait">
                            {taglineVisible && (
                                <motion.p
                                    key={taglineIdx}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                    style={{
                                        fontSize: 17,
                                        fontWeight: 400,
                                        color: '#86868b',
                                        letterSpacing: '-0.01em',
                                        margin: 0,
                                        textAlign: 'center',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {TAGLINES[taglineIdx]}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Live stat counters */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.72, duration: 0.55 }}
                        className="flex items-center gap-8 sm:gap-12 mb-11"
                    >
                        <StatItem
                            value={pixelCountAnim > 0 ? pixelCountAnim.toLocaleString('en-IN') : '—'}
                            label="pixels claimed"
                        />
                        <div className="w-px h-12" style={{ background: 'rgba(0,0,0,0.08)' }} />
                        <StatItem
                            value={brandCountAnim > 0 ? `${brandCountAnim}+` : '—'}
                            label="brands on board"
                        />
                        <div className="w-px h-12" style={{ background: 'rgba(0,0,0,0.08)' }} />
                        <StatItem value="₹100" label="per pixel" isAccent />
                    </motion.div>

                    {/* CTA buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.87, duration: 0.5 }}
                        className="flex flex-col sm:flex-row items-center gap-3 mb-20"
                    >
                        <button
                            onClick={dismiss}
                            className="group relative overflow-hidden px-9 py-4 text-[15px] font-semibold rounded-full bg-black text-white transition-all duration-200 hover:scale-[1.025] active:scale-[0.97]"
                            style={{
                                minWidth: 224,
                                boxShadow: '0 4px 24px rgba(0,0,0,0.22)',
                            }}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                Claim Your Pixels
                                <span className="group-hover:translate-x-0.5 transition-transform duration-200">
                                    →
                                </span>
                            </span>
                            {/* Hover gradient */}
                            <span className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </button>
                        <button
                            onClick={dismiss}
                            className="px-9 py-4 text-[15px] font-semibold rounded-full bg-white/75 backdrop-blur-sm transition-all duration-200 hover:bg-white hover:scale-[1.025] active:scale-[0.97]"
                            style={{
                                minWidth: 200,
                                border: '2px solid rgba(0,0,0,0.10)',
                            }}
                        >
                            Explore the Board
                        </button>
                    </motion.div>

                    {/* ── SECTION 4 — Feature cards ─────────────────── */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.02, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-12"
                        style={{ maxWidth: 660 }}
                    >
                        {FEATURES.map((f, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.1 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                whileHover={{ y: -4, transition: { duration: 0.18 } }}
                                className="p-5 rounded-2xl bg-white/72 backdrop-blur-md transition-shadow duration-200"
                                style={{
                                    border: '1px solid rgba(0,0,0,0.07)',
                                    boxShadow: '0 2px 14px rgba(0,0,0,0.055)',
                                    cursor: 'default',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.1)'; }}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 14px rgba(0,0,0,0.055)'; }}
                            >
                                <div className="text-xl font-mono mb-3 leading-none" style={{ color: 'rgba(0,0,0,0.28)' }}>
                                    {f.symbol}
                                </div>
                                <div className="text-[13px] font-semibold text-black mb-1.5">{f.title}</div>
                                <div className="text-[12px] leading-relaxed" style={{ color: 'rgba(0,0,0,0.40)' }}>
                                    {f.desc}
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* ── SECTION 5 — Social proof ──────────────────── */}
                    {uniqueBrands.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.42, duration: 0.55 }}
                            className="flex flex-col items-center gap-3"
                        >
                            <div className="flex items-center">
                                {uniqueBrands.slice(0, 7).map((b, i) => {
                                    const hue = [...(b.brandName || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
                                    return (
                                        <motion.div
                                            key={b.brandId}
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 1.52 + i * 0.07, duration: 0.36 }}
                                            title={b.brandName}
                                            className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 overflow-hidden"
                                            style={{
                                                backgroundColor: `hsl(${hue},50%,46%)`,
                                                marginLeft: i === 0 ? 0 : -10,
                                                position: 'relative',
                                                zIndex: 7 - i,
                                            }}
                                        >
                                            {(b.brandName || '?')[0].toUpperCase()}
                                        </motion.div>
                                    );
                                })}
                            </div>
                            <p className="text-[12px] font-medium" style={{ color: 'rgba(0,0,0,0.38)' }}>
                                Join {uniqueBrands.length}+ brands already competing on the board
                            </p>
                        </motion.div>
                    )}

                    {/* Animated scroll hint */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.9, duration: 0.7 }}
                        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none select-none"
                    >
                        <p className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: 'rgba(0,0,0,0.22)' }}>
                            1,000 × 1,000
                        </p>
                        <motion.div
                            animate={{ y: [0, 5, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            className="w-px h-7 bg-gradient-to-b from-black/18 to-transparent"
                        />
                    </motion.div>
                </section>
            </div>

            <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
        </motion.div>
    );
}
