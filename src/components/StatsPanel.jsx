import { useStats } from '../hooks/useBuyers';
import Card from './ui/Card';

export default function StatsPanel({ isHUD }) {
    const { data: stats } = useStats();

    if (!stats) return null;

    if (isHUD) {
        return (
            <div className="glass-card p-4 rounded-2xl flex flex-col gap-3 min-w-[200px] border border-[var(--color-border-subtle)] bg-white/70">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-tertiary)]">Network Live</span>
                </div>
                
                <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-[var(--color-text-secondary)] font-medium">Largest Region</span>
                    <span className="text-sm font-bold text-[var(--color-text-primary)]">{stats.mostPixelsOwned.count.toLocaleString()}px</span>
                </div>
                
                <div className="h-px bg-[var(--color-border-subtle)] w-full" />
                
                <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-[var(--color-text-secondary)] font-medium">Pixels Sold</span>
                    <span className="text-sm font-bold text-green-600">{stats.totalPixelsSold.toLocaleString('en-IN')}</span>
                </div>

                <div className="h-px bg-[var(--color-border-subtle)] w-full" />
                
                <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-[var(--color-text-secondary)] font-medium">Top Brand</span>
                    <span className="text-sm font-bold text-[var(--color-text-primary)] max-w-[100px] truncate" title={stats.mostPixelsOwned.brand}>{stats.mostPixelsOwned.brand}</span>
                </div>
            </div>
        );
    }

    return null;
}
