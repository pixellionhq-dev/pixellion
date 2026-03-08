import { useState, useEffect } from 'react';
import AuthModal from './AuthModal';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const { user, logout } = useAuth();

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <nav
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out bg-white/80 backdrop-blur-xl border border-white/40 shadow-sm ${scrolled ? 'py-4' : 'py-6'}`}
            >
                <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
                    {/* Brand */}
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-[var(--color-text-primary)] rounded-lg flex items-center justify-center transform transition hover:scale-105">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="3" y="3" width="7" height="7" fill="white" />
                                <rect x="14" y="3" width="7" height="7" fill="white" fillOpacity="0.5" />
                                <rect x="3" y="14" width="7" height="7" fill="white" fillOpacity="0.5" />
                                <rect x="14" y="14" width="7" height="7" fill="white" />
                            </svg>
                        </div>
                        <span className="font-semibold text-lg tracking-tight text-[var(--color-text-primary)]">
                            Pixellion
                        </span>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#board" className="text-[14px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition">Board</a>
                        <a href="#leaderboard" className="text-[14px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition">Leaderboard</a>
                        <a href="#directory" className="text-[14px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition">Directory</a>
                    </div>

                    {/* Desktop Auth */}
                    <div className="hidden md:flex items-center gap-4">
                        {user ? (
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    {user.buyer && (
                                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: user.buyer.color }} />
                                    )}
                                    <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
                                        {user.username}
                                    </span>
                                </div>
                                <button
                                    onClick={logout}
                                    className="text-[14px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
                                >
                                    Sign Out
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setAuthModalOpen(true)}
                                className="bg-[var(--color-text-primary)] text-white px-5 py-2.5 rounded-full text-[14px] font-medium
                  hover:bg-black transition-all hover:scale-[1.02] shadow-sm flex items-center gap-2 group"
                            >
                                Sign In
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform transition-transform group-hover:translate-x-0.5">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="md:hidden text-[var(--color-text-primary)] p-2"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            {mobileMenuOpen ? (
                                <path d="M18 6L6 18M6 6l12 12" />
                            ) : (
                                <path d="M3 12h18M3 6h18M3 18h18" />
                            )}
                        </svg>
                    </button>
                </div>

                {/* Mobile Menu Content */}
                {mobileMenuOpen && (
                    <div className="md:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-md border-b border-[var(--color-border)] px-6 py-6 flex flex-col gap-6 animate-fade-in shadow-xl">
                        <a href="#board" className="text-[15px] font-medium text-[var(--color-text-primary)]" onClick={() => setMobileMenuOpen(false)}>Board</a>
                        <a href="#leaderboard" className="text-[15px] font-medium text-[var(--color-text-primary)]" onClick={() => setMobileMenuOpen(false)}>Leaderboard</a>
                        <a href="#directory" className="text-[15px] font-medium text-[var(--color-text-primary)]" onClick={() => setMobileMenuOpen(false)}>Directory</a>
                        <div className="h-px bg-[var(--color-border)] w-full" />

                        {user ? (
                            <div className="flex flex-col gap-4">
                                <span className="text-[15px] font-medium text-[var(--color-text-secondary)]">
                                    Signed in as {user.username}
                                </span>
                                <button
                                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                                    className="text-left text-[15px] font-medium text-red-500"
                                >
                                    Sign Out
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setAuthModalOpen(true); setMobileMenuOpen(false); }}
                                className="bg-[var(--color-text-primary)] text-white w-full py-3 rounded-lg text-[15px] font-medium text-center"
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                )}
            </nav>

            <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        </>
    );
}
