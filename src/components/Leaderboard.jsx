import { motion } from 'framer-motion';
import { useLeaderboard } from '../hooks/useBuyers';

export default function Leaderboard() {
    const { data: leaderboardData } = useLeaderboard();
    const maxPixels = leaderboardData?.[0]?.pixels || 1;

    return (
        <section
            id="leaderboard"
            className="bg-[var(--color-surface-elevated)] border-y border-[var(--color-border-subtle)] py-20 w-full"
            style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.03) 1px, transparent 1px)', backgroundSize: '16px 16px' }}
        >
            <div className="px-6 max-w-5xl mx-auto w-full">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
                            Top Brands
                        </h2>
                        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
                            Ranked by total pixels owned on the board
                        </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-[var(--color-text-tertiary)] bg-[var(--color-surface-elevated)] px-3 py-1.5 rounded-full shadow-sm border border-[var(--color-border)]">
                        <span className="w-2 h-2 rounded-full bg-green-500" style={{ animation: 'pulseRing 2s ease-out infinite' }}></span>
                        Live Rankings
                    </div>
                </div>

                <div className="glass-card overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-[60px_1fr_100px] sm:grid-cols-[80px_1fr_120px_100px] gap-4 px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50">
                        <div className="text-xs font-medium text-[var(--color-text-tertiary)]">Rank</div>
                        <div className="text-xs font-medium text-[var(--color-text-tertiary)]">Brand</div>
                        <div className="hidden sm:block text-xs font-medium text-[var(--color-text-tertiary)] text-right">HQ</div>
                        <div className="text-xs font-medium text-[var(--color-text-tertiary)] text-right">Pixels</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-[var(--color-border)]">
                        {leaderboardData && leaderboardData.length > 0 ? (
                            leaderboardData.map((entry, index) => {
                                // Medals for top 3
                                let rankDisplay = <span className="text-base font-semibold text-[var(--color-text-tertiary)]">#{entry.rank}</span>;
                                if (entry.rank === 1) rankDisplay = <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 6px rgba(234,179,8,0.3))' }} title="1st Place">🥇</span>;
                                if (entry.rank === 2) rankDisplay = <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 6px rgba(148,163,184,0.3))' }} title="2nd Place">🥈</span>;
                                if (entry.rank === 3) rankDisplay = <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 6px rgba(180,83,9,0.3))' }} title="3rd Place">🥉</span>;
                                const progress = Math.max(0, Math.min(100, (entry.pixels / maxPixels) * 100));

                                return (
                                    <motion.div
                                        key={entry.brand}
                                        whileHover={{ scale: 1.01, backgroundColor: 'var(--color-surface-hover)' }}
                                        whileTap={{ scale: 0.99 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        className={`grid grid-cols-[60px_1fr_100px] sm:grid-cols-[80px_1fr_120px_100px] gap-4 px-6 py-4 items-center group stagger-${(index % 10) + 1} border-l-[3px] border-transparent cursor-pointer`}
                                        style={{ borderLeftColor: 'transparent' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderLeftColor = entry.color; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderLeftColor = 'transparent'; }}
                                    >
                                        <div className="flex items-center justify-center w-8">
                                            {rankDisplay}
                                        </div>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div
                                                className="w-8 h-8 rounded-full shadow-sm flex-shrink-0 relative overflow-hidden group-hover:scale-110 transition-transform duration-300"
                                                style={{ backgroundColor: entry.color }}
                                            >
                                                <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
                                            </div>
                                            <span className="font-semibold text-base text-[var(--color-text-primary)] truncate min-w-0">
                                                {entry.brand}
                                            </span>
                                        </div>
                                        <div className="hidden sm:flex items-center justify-end gap-2 isolate">
                                            <span className="text-sm">{entry.flag}</span>
                                            <span className="text-sm font-medium text-[var(--color-text-secondary)]">{entry.country}</span>
                                        </div>
                                        <div className="flex items-center justify-end">
                                            <div className="w-20 text-right">
                                                <span className="inline-flex items-center justify-end px-2.5 py-1 rounded-md bg-[var(--color-surface-hover)] text-sm font-bold text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] w-full font-mono">
                                                    {entry.pixels}
                                                </span>
                                                <div className="mt-1 h-[2px] w-full bg-[var(--color-border-subtle)] rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: entry.color }} />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })
                        ) : (
                            <div className="py-12 text-center text-[var(--color-text-tertiary)] text-sm">
                                No data available
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
