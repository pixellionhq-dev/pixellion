import { useStats } from '../hooks/useBuyers';

export default function Hero() {
    const { data: stats } = useStats();

    return (
        <section className="pt-40 pb-20 px-6 max-w-5xl mx-auto flex flex-col items-center text-center opacity-0 animate-fade-up relative">
            {/* Live Indicator */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 border border-white/70" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(18px)', boxShadow: '0 0 12px rgba(34,197,94,0.15)' }}>
                <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" style={{ animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }}></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-medium text-[var(--color-text-secondary)] tracking-wide uppercase">
                    Live Board Active
                </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #374151 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Own a piece of the <br className="hidden md:block" />
                digital billboard.
            </h1>

            {/* Subtitle */}
            <p className="text-xl text-[var(--color-text-secondary)] mb-12 max-w-2xl font-light leading-relaxed" style={{ letterSpacing: '0.01em' }}>
                Pixellion is a competitive canvas where the world's most innovative brands stake their claim.
                Buy pixels, upload your logo, and join the elite directory.
            </p>

            {/* Quick Stats Grid */}
            <div className="relative grid grid-cols-3 gap-3 md:gap-6 mt-4 max-w-3xl w-full">
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 rounded-full" style={{ width: 600, height: 600, background: 'radial-gradient(circle, rgba(37,99,235,0.04) 0%, transparent 70%)' }} />
                <div className="glass-card py-6 px-4 flex flex-col items-center justify-center opacity-0 animate-fade-up stagger-2">
                    <span className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
                        {stats ? stats.totalPixelsSold.toLocaleString() : <span className="animate-pulse">...</span>}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-tertiary)] mt-1">Pixels Claimed</span>
                </div>
                <div className="glass-card py-6 px-4 flex flex-col items-center justify-center opacity-0 animate-fade-up stagger-3">
                    <span className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
                        {stats ? stats.totalBuyers.toLocaleString() : <span className="animate-pulse">...</span>}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-tertiary)] mt-1">Active Brands</span>
                </div>
                <div className="glass-card py-6 px-4 flex flex-col items-center justify-center opacity-0 animate-fade-up stagger-4 border-transparent group transition-colors" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1e293b 100%)', boxShadow: '0 8px 32px rgba(37,99,235,0.2)' }}>
                    <span className="text-2xl md:text-3xl font-bold tracking-tight text-white group-hover:scale-105 transition-transform">
                        {stats ? `₹${stats.currentPixelPrice.toLocaleString('en-IN')}` : <span className="animate-pulse">...</span>}
                    </span>
                    <span className="text-sm font-medium text-white/60 mt-1">Current Price / px</span>
                </div>
            </div>
        </section>
    );
}
