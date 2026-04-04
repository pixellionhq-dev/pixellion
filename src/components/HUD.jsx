import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import Navbar from './Navbar';
import StatsPanel from './StatsPanel';
import Leaderboard from './Leaderboard';
import BrandSearch from './BrandSearch';
import { useAuth } from '../hooks/useAuth';

export default function HUD() {
    const { user } = useAuth();
    const [leaderboardOpen, setLeaderboardOpen] = useState(false);

    return (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            {/* Top Bar Area */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none z-50">
                <div className="pointer-events-auto">
                    <Navbar onToggleLeaderboard={() => setLeaderboardOpen(!leaderboardOpen)} />
                </div>
                <div className="pointer-events-auto origin-top-right scale-[0.85] opacity-90 hover:opacity-100 hover:scale-100 transition-all duration-300">
                    <StatsPanel isHUD={true} />
                </div>
            </div>

            {/* Left Drawer: Leaderboard */}
            <AnimatePresence>
                {leaderboardOpen && (
                    <motion.div
                        initial={{ x: '-100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '-100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="absolute top-24 left-6 bottom-6 w-96 pointer-events-auto z-40 rounded-[32px] overflow-hidden glass-card shadow-2xl flex flex-col border border-[var(--color-border-subtle)]"
                    >
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/40">
                             <Leaderboard isHUD={true} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Command Palette Hint */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center opacity-60">
                <kbd className="px-3 py-1.5 rounded-lg bg-black/60 text-white backdrop-blur-md text-xs font-mono border border-white/20 shadow-lg">
                    ⌘K to Search
                </kbd>
            </div>
        </div>
    );
}
