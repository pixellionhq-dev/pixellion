import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import usePixelViewport from '../store/usePixelViewport';

export default function CommandPalette({ onSelectBrand }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const { brands } = usePixelViewport(state => ({ brands: state.brands }));

    useEffect(() => {
        const down = (e) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const filteredBrands = query === '' 
        ? [] 
        : (brands || []).filter((brand) => brand.brandName?.toLowerCase().includes(query.toLowerCase()));

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setOpen(false)}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, scale: 0.95, y: -20, x: '-50%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed top-[20%] left-1/2 w-full max-w-xl bg-white/90 glass-card rounded-2xl shadow-2xl overflow-hidden z-[101] border border-[var(--color-border)]"
                    >
                        <div className="flex items-center px-4 py-4 border-b border-[var(--color-border-subtle)]">
                            <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                autoFocus
                                type="text"
                                className="w-full bg-transparent text-lg text-gray-900 placeholder-gray-400 outline-none"
                                placeholder="Search brands across the map..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            <kbd className="hidden sm:inline-block px-2 text-xs font-semibold text-gray-400 bg-gray-100 rounded">ESC</kbd>
                        </div>
                        
                        {filteredBrands.length > 0 && (
                            <ul className="max-h-72 overflow-y-auto py-2">
                                {filteredBrands.map((brand) => (
                                    <li
                                        key={brand.brandId}
                                        onClick={() => {
                                            if (onSelectBrand) onSelectBrand(brand);
                                            setOpen(false);
                                        }}
                                        className="px-4 py-3 hover:bg-[var(--color-surface-hover)] cursor-pointer flex items-center justify-between group transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className="w-8 h-8 rounded-full overflow-hidden shadow-sm border border-black/5 bg-center bg-cover bg-no-repeat flex-shrink-0"
                                                style={{ 
                                                    backgroundColor: brand.color,
                                                    backgroundImage: brand.logoUrl ? `url(${brand.logoUrl})` : 'none'
                                                }}
                                            />
                                            <span className="font-semibold text-[var(--color-text-primary)] group-hover:text-black">
                                                {brand.brandName}
                                            </span>
                                        </div>
                                        <span className="text-xs text-[var(--color-text-tertiary)] font-mono">
                                            {brand.totalPixels?.toLocaleString()} px
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {query !== '' && filteredBrands.length === 0 && (
                            <div className="px-4 py-12 text-center text-gray-500 text-sm">
                                No brands found matching "{query}"
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
