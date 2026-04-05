import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AuthModal from './AuthModal';
import { useAuth } from '../hooks/useAuth';

export default function Navbar({ onToggleLeaderboard, onShowShortcuts }) {
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const { user, logout } = useAuth();

    return (
        <>
            <nav className="glass-card flex items-center gap-6 px-4 py-3 rounded-[32px] border border-[var(--color-border-subtle)] shadow-lg bg-white/70">
                {/* Brand */}
                <div className="flex items-center gap-2 group cursor-default px-2">
                    <div className="w-6 h-6 bg-[var(--color-text-primary)] rounded-[6px] grid grid-cols-2 grid-rows-2 p-[3px] gap-[1.5px] transform transition duration-300 group-hover:scale-105">
                        <span className="rounded-[1.5px] bg-white/80 transition-opacity duration-300 group-hover:opacity-100" />
                        <span className="rounded-[1.5px] bg-white/50 transition-opacity duration-300 group-hover:opacity-40" />
                        <span className="rounded-[1.5px] bg-white/50 transition-opacity duration-300 group-hover:opacity-40" />
                        <span className="rounded-[1.5px] bg-white/80 transition-opacity duration-300 group-hover:opacity-100" />
                    </div>
                    <span className="font-semibold text-sm tracking-tight text-[var(--color-text-primary)]">
                        Pixellion
                    </span>
                </div>

                <div className="w-px h-6 bg-[var(--color-border-subtle)]" />

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-6">
                    <motion.button 
                        whileHover={{ scale: 1.05 }} 
                        whileTap={{ scale: 0.95 }} 
                        onClick={onToggleLeaderboard}
                        className="group relative text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
                    >
                        Leaderboard
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                        className="group relative text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
                    >
                        Directory
                    </motion.button>
                    {onShowShortcuts && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onShowShortcuts}
                            className="group relative text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition flex items-center gap-1"
                            title="Keyboard shortcuts (?)"
                        >
                            <kbd className="text-[10px] px-1 py-0.5 bg-gray-100 rounded font-mono">?</kbd>
                        </motion.button>
                    )}
                </div>

                <div className="w-px h-6 bg-[var(--color-border-subtle)] hidden md:block" />

                    {/* Desktop Auth */}
                    <div className="flex items-center">
                        {user ? (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => document.dispatchEvent(new CustomEvent('map:zoomToBrand', { detail: user.username }))}>
                                    {user.buyer && (
                                        <div className="w-5 h-5 rounded-[4px] flex-shrink-0" style={{ backgroundColor: user.buyer.color }} />
                                    )}
                                    <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                                        {user.username}
                                    </span>
                                    {user.buyer?.pixelCount > 0 && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-accent)] text-white leading-none">
                                            {user.buyer.pixelCount.toLocaleString()}px
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={logout}
                                    className="text-xs font-medium text-[var(--color-text-tertiary)] hover:text-red-500 transition px-2"
                                >
                                    Sign Out
                                </button>
                            </div>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => setAuthModalOpen(true)}
                                className="bg-[var(--color-text-primary)] text-white px-4 py-1.5 rounded-[12px] text-xs font-semibold hover:bg-black transition-all shadow-sm"
                            >
                                Sign In
                            </motion.button>
                        )}
                    </div>
            </nav>

            <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        </>
    );
}
