import { memo } from 'react';
import { motion } from 'framer-motion';
import { useStats } from '../hooks/useBuyers';
import Card from './ui/Card';

const StatsPanel = memo(function StatsPanel({ isHUD }) {
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
                    <motion.span
                        key={stats.mostPixelsOwned.count}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className="text-sm font-bold text-[var(--color-text-primary)]"
                    >{stats.mostPixelsOwned.count.toLocaleString()}px</motion.span>
                </div>
                
                <div className="h-px bg-[var(--color-border-subtle)] w-full" />
                
                <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-[var(--color-text-secondary)] font-medium">Pixels Sold</span>
                    <motion.span
                        key={stats.totalPixelsSold}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
                        className="text-sm font-bold text-green-600"
                    >{stats.totalPixelsSold.toLocaleString('en-IN')}</motion.span>
                </div>

                <div className="h-px bg-[var(--color-border-subtle)] w-full" />
                
                <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-[var(--color-text-secondary)] font-medium">Top Brand</span>
                    <motion.span
                        key={stats.mostPixelsOwned.brand}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
                        className="text-sm font-bold text-[var(--color-text-primary)] max-w-[100px] truncate"
                        title={stats.mostPixelsOwned.brand}
                    >{stats.mostPixelsOwned.brand}</motion.span>
                </div>
            </div>
        );
    }

    return null;
});

export default StatsPanel;
