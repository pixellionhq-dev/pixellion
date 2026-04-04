import { motion } from 'framer-motion';
import { useStats } from '../hooks/useBuyers';

const FADE_UP_ANIMATION_VARIANTS = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } },
};

export default function Hero() {
    const { data: stats } = useStats();

    return (
        <motion.section 
            initial="hidden"
            animate="show"
            viewport={{ once: true }}
            variants={{
                hidden: {},
                show: {
                    transition: {
                        staggerChildren: 0.15,
                    },
                },
            }}
            className="pt-40 pb-20 px-6 max-w-5xl mx-auto flex flex-col items-center text-center relative z-10"
        >
            {/* Live Indicator */}
            <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 border border-white/70" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(18px)', boxShadow: '0 0 12px rgba(34,197,94,0.15)' }}>
                <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" style={{ animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }}></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-medium text-[var(--color-text-secondary)] tracking-wide uppercase">
                    Live Board Active
                </span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1 variants={FADE_UP_ANIMATION_VARIANTS} className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #374151 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '-0.02em' }}>
                Own a piece of the <br className="hidden md:block" />
                digital billboard.
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={FADE_UP_ANIMATION_VARIANTS} className="text-xl text-[var(--color-text-secondary)] mb-12 max-w-2xl font-light leading-relaxed" style={{ letterSpacing: '0.01em' }}>
                Pixellion is a competitive canvas where the world's most innovative brands stake their claim.
                Buy pixels, upload your logo, and join the elite directory.
            </motion.p>

            {/* Quick Stats Grid */}
            <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="grid grid-cols-3 gap-3 md:gap-6 mt-4 max-w-3xl w-full">
                <div className="glass-card py-6 px-4 flex flex-col items-center justify-center">
                    <span className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
                        {stats?.totalPixelsSold != null ? stats.totalPixelsSold.toLocaleString() : <span className="animate-pulse">...</span>}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-tertiary)] mt-1">Pixels Claimed</span>
                </div>
                <div className="glass-card py-6 px-4 flex flex-col items-center justify-center">
                    <span className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
                        {stats?.totalBuyers != null ? stats.totalBuyers.toLocaleString() : <span className="animate-pulse">...</span>}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-tertiary)] mt-1">Active Brands</span>
                </div>
                <div className="glass-card py-6 px-4 flex flex-col items-center justify-center transition-transform hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1e293b 100%)',
                                     boxShadow: '0 8px 32px rgba(37,99,235,0.2)' }}>
                    <span className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                        {stats?.currentPixelPrice != null ? `₹${stats.currentPixelPrice.toLocaleString('en-IN')}` : <span className="animate-pulse">...</span>}
                    </span>
                    <span className="text-sm font-medium text-white/60 mt-1">Current Price / px</span>
                </div>
            </motion.div>
        </motion.section>
    );
}
