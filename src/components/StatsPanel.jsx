import { useStats } from '../hooks/useBuyers';
import Card from './ui/Card';

export default function StatsPanel() {
    const { data: stats } = useStats();

    if (!stats) return null;

    return (
        <section className="py-20 w-full">
            <div className="px-6 max-w-5xl mx-auto w-full">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-6 text-center">
                    Platform Intelligence
                </h3>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Most Expensive */}
                    <Card className="group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                </svg>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Most Expensive Pixel</p>
                            <p className="text-xl font-bold text-[var(--color-text-primary)] mt-1">₹{stats.mostExpensivePixel.price.toLocaleString('en-IN')}</p>
                            <p className="text-xs text-[var(--color-text-tertiary)] mt-2 bg-[var(--color-surface-hover)] inline-block px-2 py-0.5 rounded-md">
                                Owned by <span className="font-semibold text-[var(--color-text-secondary)]">{stats.mostExpensivePixel.owner}</span>
                            </p>
                        </div>
                    </Card>

                    {/* Most Pixels Owned */}
                    <Card className="group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 transition-colors group-hover:bg-blue-500 group-hover:text-white">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="7" height="7" />
                                    <rect x="14" y="3" width="7" height="7" />
                                    <rect x="14" y="14" width="7" height="7" />
                                    <rect x="3" y="14" width="7" height="7" />
                                </svg>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Largest Property</p>
                            <p className="text-xl font-bold text-[var(--color-text-primary)] mt-1">{stats.mostPixelsOwned.count.toLocaleString()} px</p>
                            <p className="text-xs text-[var(--color-text-tertiary)] mt-2 bg-[var(--color-surface-hover)] inline-block px-2 py-0.5 rounded-md">
                                Owned by <span className="font-semibold text-[var(--color-text-secondary)]">{stats.mostPixelsOwned.brand}</span>
                            </p>
                        </div>
                    </Card>

                    {/* Total Value */}
                    <Card className="group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600 transition-colors group-hover:bg-green-500 group-hover:text-white">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                                    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                                    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                                </svg>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Total Market Volume</p>
                            <p className="text-xl font-bold text-[var(--color-text-primary)] mt-1">
                                ₹{(stats.totalPixelsSold * stats.currentPixelPrice).toLocaleString('en-IN')}
                            </p>
                            <p className="text-xs text-[var(--color-text-tertiary)] mt-2 bg-[var(--color-surface-hover)] inline-block px-2 py-0.5 rounded-md">
                                Across <span className="font-semibold text-[var(--color-text-secondary)]">{stats.totalPixelsSold}</span> pixels
                            </p>
                        </div>
                    </Card>

                    {/* Newest Entry */}
                    <Card className="group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 transition-colors group-hover:bg-purple-500 group-hover:text-white">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    <path d="m9 12 2 2 4-4" />
                                </svg>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Newest Member</p>
                            <p className="text-xl font-bold text-[var(--color-text-primary)] mt-1">{stats.newestBuyer.brand}</p>
                            <p className="text-xs text-[var(--color-text-tertiary)] mt-2 bg-[var(--color-surface-hover)] inline-block px-2 py-0.5 rounded-md">
                                <span className="font-semibold text-[var(--color-accent)]">Active</span> account
                            </p>
                        </div>
                    </Card>
                </div>
            </div>
        </section>
    );
}
