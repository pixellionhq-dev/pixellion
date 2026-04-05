import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import usePixelViewport from '../store/usePixelViewport';

const RECENT_KEY = 'px_recent_searches';
const MAX_RECENT = 3;

function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
    catch { return []; }
}

function saveRecent(brandName) {
    try {
        const prev = getRecent().filter(n => n !== brandName);
        localStorage.setItem(RECENT_KEY, JSON.stringify([brandName, ...prev].slice(0, MAX_RECENT)));
    } catch { /* ignore */ }
}

// Highlight matching characters in a string
function HighlightMatch({ text, query }) {
    if (!query) return <span>{text}</span>;
    const lower = text.toLowerCase();
    const qLower = query.toLowerCase();
    const idx = lower.indexOf(qLower);
    if (idx === -1) return <span>{text}</span>;
    return (
        <span>
            {text.slice(0, idx)}
            <mark className="bg-blue-100 text-blue-800 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
            {text.slice(idx + query.length)}
        </span>
    );
}

export default function CommandPalette({ onSelectBrand }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    const { brands } = usePixelViewport(state => ({ brands: state.brands }));

    // Deduplicate brands by brandName, summing pixels
    const dedupedBrands = useMemo(() => {
        if (!brands) return [];
        const map = new Map();
        for (const b of brands) {
            const name = b.brandName || '';
            if (!name) continue;
            if (map.has(name)) {
                const existing = map.get(name);
                existing.totalPixels = (existing.totalPixels || 0) + (b.totalPixels || 0);
            } else {
                map.set(name, { ...b });
            }
        }
        return Array.from(map.values());
    }, [brands]);

    const recent = useMemo(() => getRecent(), [open]); // re-read on open

    const filteredBrands = useMemo(() => {
        if (!query) return [];
        const q = query.toLowerCase();
        return dedupedBrands
            .filter(b => b.brandName?.toLowerCase().includes(q))
            .slice(0, 12);
    }, [dedupedBrands, query]);

    const displayItems = query ? filteredBrands : [];
    const recentBrands = !query
        ? dedupedBrands.filter(b => recent.includes(b.brandName)).slice(0, MAX_RECENT)
        : [];

    const allItems = query ? displayItems : recentBrands;

    // Reset selection when items change
    useEffect(() => { setSelectedIndex(0); }, [query]);

    // Scroll selected item into view
    useEffect(() => {
        if (!listRef.current) return;
        const el = listRef.current.children[selectedIndex];
        el?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    const handleSelect = useCallback((brand) => {
        saveRecent(brand.brandName);
        if (onSelectBrand) onSelectBrand(brand);
        setOpen(false);
        setQuery('');
    }, [onSelectBrand]);

    useEffect(() => {
        const down = (e) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen(o => !o);
            }
            if (!open) return;
            if (e.key === 'Escape') { setOpen(false); setQuery(''); }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
            }
            if (e.key === 'Enter' && allItems[selectedIndex]) {
                e.preventDefault();
                handleSelect(allItems[selectedIndex]);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [open, allItems, selectedIndex, handleSelect]);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setQuery('');
            setSelectedIndex(0);
        }
    }, [open]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => { setOpen(false); setQuery(''); }}
                        className="fixed inset-0 bg-black/30 backdrop-blur-[8px] z-[100]"
                    />

                    {/* Palette */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -8 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 380, mass: 0.6 }}
                        style={{ position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)' }}
                        className="w-full max-w-xl glass-card rounded-2xl shadow-2xl overflow-hidden z-[101]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Search input */}
                        <div className="flex items-center px-4 py-3.5 border-b border-[var(--color-border-subtle)]">
                            <svg className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                ref={inputRef}
                                type="text"
                                className="flex-1 bg-transparent text-base text-gray-900 placeholder-gray-400 outline-none"
                                placeholder="Search brands on the map…"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                            />
                            {query && (
                                <button
                                    onClick={() => setQuery('')}
                                    className="text-gray-400 hover:text-gray-600 transition ml-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                            <kbd className="hidden sm:inline-flex items-center ml-3 px-2 py-0.5 text-[11px] font-semibold text-gray-400 bg-gray-100 rounded">ESC</kbd>
                        </div>

                        {/* Results */}
                        {(allItems.length > 0 || (!query && recent.length === 0)) && (
                            <div>
                                {!query && recentBrands.length > 0 && (
                                    <div className="px-4 pt-3 pb-1">
                                        <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Recent</span>
                                    </div>
                                )}
                                {query && filteredBrands.length > 0 && (
                                    <div className="px-4 pt-3 pb-1">
                                        <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">{filteredBrands.length} brand{filteredBrands.length !== 1 ? 's' : ''} found</span>
                                    </div>
                                )}
                                <ul ref={listRef} className="max-h-72 overflow-y-auto py-1 custom-scrollbar">
                                    {allItems.map((brand, i) => (
                                        <li
                                            key={brand.brandId || brand.brandName}
                                            onMouseEnter={() => setSelectedIndex(i)}
                                            onClick={() => handleSelect(brand)}
                                            className={`px-4 py-2.5 cursor-pointer flex items-center justify-between gap-3 transition-colors ${i === selectedIndex ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                {/* Brand logo */}
                                                <div
                                                    className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden border border-black/5 shadow-sm bg-gray-100"
                                                    style={{
                                                        backgroundColor: brand.color || '#e5e7eb',
                                                        backgroundImage: brand.logoUrl ? `url(${brand.logoUrl})` : 'none',
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center',
                                                    }}
                                                />
                                                <span className="font-medium text-[var(--color-text-primary)] text-sm truncate">
                                                    <HighlightMatch text={brand.brandName || ''} query={query} />
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-xs text-[var(--color-text-tertiary)] font-mono">
                                                    {(brand.totalPixels || 0).toLocaleString()} px
                                                </span>
                                                {i === selectedIndex && (
                                                    <kbd className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">↵</kbd>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Empty state */}
                        {query && filteredBrands.length === 0 && (
                            <div className="px-4 py-12 text-center">
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <p className="text-sm text-gray-500 font-medium">No brands matching "{query}"</p>
                                <p className="text-xs text-gray-400 mt-1">Try a different name</p>
                            </div>
                        )}

                        {/* Empty + no recent */}
                        {!query && recentBrands.length === 0 && (
                            <div className="px-4 py-10 text-center">
                                <p className="text-sm text-gray-400">Start typing to search brands…</p>
                                <div className="flex items-center justify-center gap-3 mt-3 text-[11px] text-gray-400">
                                    <span>↑↓ navigate</span>
                                    <span>↵ select</span>
                                    <span>ESC close</span>
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="px-4 py-2.5 border-t border-[var(--color-border-subtle)] flex items-center gap-3 text-[11px] text-gray-400">
                            <span>↑↓ navigate</span>
                            <span>↵ zoom to brand</span>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
