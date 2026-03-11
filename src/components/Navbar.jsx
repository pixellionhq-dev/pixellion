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
            <div
                className="fixed top-0 left-0 right-0 z-[60] h-[2px]"
                style={{
                    background: 'linear-gradient(90deg, #2563eb, #7c3aed, #2563eb)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 3s linear infinite'
                }}
            />
            <nav
                className={`fixed top-[2px] left-0 right-0 z-50 transition-all duration-300 ease-in-out bg-white/80 backdrop-blur-xl border border-white/40 ${scrolled ? 'py-4 shadow-[0_1px_0_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]' : 'py-6'}`}
            >
                <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
                    {/* Brand */}
                    <div className="flex items-center gap-2.5 group cursor-default">
                        <div className="w-8 h-8 bg-[var(--color-text-primary)] rounded-lg grid grid-cols-2 grid-rows-2 p-[4px] gap-[2px] transform transition duration-300 group-hover:scale-105">
                            <span className="rounded-[2px] bg-white/80 transition-opacity duration-300 group-hover:opacity-100" />
                            <span className="rounded-[2px] bg-white/50 transition-opacity duration-300 group-hover:opacity-40" />
                            <span className="rounded-[2px] bg-white/50 transition-opacity duration-300 group-hover:opacity-40" />
                            <span className="rounded-[2px] bg-white/80 transition-opacity duration-300 group-hover:opacity-100" />
                        </div>
                        <span className="font-semibold text-lg tracking-tight text-[var(--color-text-primary)]">
                            Pixellion
                        </span>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#board" className="group relative text-[14px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition">
                            Board
                            <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-[var(--color-text-primary)] transition-all duration-300 group-hover:w-full" />
                        </a>
                        <a href="#leaderboard" className="group relative text-[14px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition">
                            Leaderboard
                            <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-[var(--color-text-primary)] transition-all duration-300 group-hover:w-full" />
                        </a>
                        <a href="#directory" className="group relative text-[14px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition">
                            Directory
                            <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-[var(--color-text-primary)] transition-all duration-300 group-hover:w-full" />
                        </a>
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
                                className="relative overflow-hidden bg-[var(--color-text-primary)] text-white px-5 py-2.5 rounded-xl text-[14px] font-medium hover:bg-black transition-all shadow-sm flex items-center gap-2 group"
                            >
                                <span className="absolute inset-y-0 -left-1/2 w-1/2 bg-white/20 skew-x-[-20deg] opacity-0 group-hover:opacity-100 group-hover:translate-x-[260%] transition-all duration-[600ms] pointer-events-none" />
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
