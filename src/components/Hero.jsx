import { useStats } from '../hooks/useBuyers';

export default function Hero() {
    const { data: stats } = useStats();

    return (
        <section className="pt-40 pb-20 px-6 max-w-5xl mx-auto flex flex-col items-center text-center animate-fade-in-up">
            {/* Live Indicator */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/[0.03] border border-black/[0.08] mb-8">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-medium text-[var(--color-text-secondary)] tracking-wide uppercase">
                    Live Board Active
                </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[var(--color-text-primary)] mb-6 leading-[1.1]">
                Own a piece of the <br className="hidden md:block" />
                digital billboard.
            </h1>

            {/* Subtitle */}
            <p className="text-xl text-[var(--color-text-secondary)] mb-12 max-w-2xl font-light leading-relaxed">
                Pixellion is a competitive canvas where the world's most innovative brands stake their claim.
                Buy pixels, upload your logo, and join the elite directory.
            </p>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3 md:gap-6 mt-4 max-w-3xl w-full">
                <div className="glass-card py-6 px-4 flex flex-col items-center justify-center stagger-1">
                    <span className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
                        {stats ? stats.totalPixelsSold.toLocaleString() : '---'}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-tertiary)] mt-1">Pixels Claimed</span>
                </div>
                <div className="glass-card py-6 px-4 flex flex-col items-center justify-center stagger-2">
                    <span className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
                        {stats ? stats.totalBuyers.toLocaleString() : '---'}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-tertiary)] mt-1">Active Brands</span>
                </div>
                <div className="glass-card py-6 px-4 flex flex-col items-center justify-center stagger-3 bg-[var(--color-text-primary)] border-transparent group transition-colors">
                    <span className="text-2xl md:text-3xl font-bold tracking-tight text-white group-hover:scale-105 transition-transform">
                        {stats ? `₹${stats.currentPixelPrice.toLocaleString('en-IN')}` : '---'}
                    </span>
                    <span className="text-sm font-medium text-white/60 mt-1">Current Price / px</span>
                </div>
            </div>
        </section>
    );
}
