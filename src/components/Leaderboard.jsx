import { useLeaderboard } from '../hooks/useBuyers';

export default function Leaderboard() {
    const { data: leaderboardData } = useLeaderboard();

    return (
        <section id="leaderboard" className="bg-[var(--color-surface-elevated)] border-y border-[var(--color-border-subtle)] py-20 w-full">
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
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Live Rankings
                    </div>
                </div>

                <div className="glass-card overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-[60px_1fr_100px] sm:grid-cols-[80px_1fr_120px_100px] gap-4 px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50">
                        <div className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Rank</div>
                        <div className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Brand</div>
                        <div className="hidden sm:block text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider text-right">HQ</div>
                        <div className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider text-right">Pixels</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-[var(--color-border)]">
                        {leaderboardData && leaderboardData.length > 0 ? (
                            leaderboardData.map((entry, index) => {
                                // Medals for top 3
                                let rankDisplay = <span className="text-base font-semibold text-[var(--color-text-tertiary)]">#{entry.rank}</span>;
                                if (entry.rank === 1) rankDisplay = <span className="text-xl" title="1st Place">🥇</span>;
                                if (entry.rank === 2) rankDisplay = <span className="text-xl" title="2nd Place">🥈</span>;
                                if (entry.rank === 3) rankDisplay = <span className="text-xl" title="3rd Place">🥉</span>;

                                return (
                                    <div
                                        key={entry.brand}
                                        className={`leaderboard-row grid grid-cols-[60px_1fr_100px] sm:grid-cols-[80px_1fr_120px_100px] gap-4 px-6 py-4 items-center group stagger-${(index % 10) + 1}`}
                                    >
                                        <div className="flex items-center justify-center w-8">
                                            {rankDisplay}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-8 h-8 rounded-lg shadow-sm flex-shrink-0 relative overflow-hidden group-hover:scale-110 transition-transform duration-300"
                                                style={{ backgroundColor: entry.color }}
                                            >
                                                <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
                                            </div>
                                            <span className="font-semibold text-base text-[var(--color-text-primary)] truncate">
                                                {entry.brand}
                                            </span>
                                        </div>
                                        <div className="hidden sm:flex items-center justify-end gap-2 isolate">
                                            <span className="text-sm">{entry.flag}</span>
                                            <span className="text-sm font-medium text-[var(--color-text-secondary)]">{entry.country}</span>
                                        </div>
                                        <div className="flex items-center justify-end">
                                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-[var(--color-surface-hover)] text-sm font-bold text-[var(--color-text-primary)] border border-[var(--color-border)] w-16 text-right font-mono">
                                                {entry.pixels}
                                            </span>
                                        </div>
                                    </div>
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
