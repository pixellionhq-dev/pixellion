import { useState, useMemo, useRef, useEffect } from 'react';

/**
 * BrandSearch — search input with autocomplete dropdown.
 * When a brand is selected, calls onSelectBrand(brandName).
 *
 * Props:
 *   ownedPixels   – array of pixel data
 *   onSelectBrand – (brandName) => void
 */
export default function BrandSearch({ ownedPixels, onSelectBrand }) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    // Derive unique brand list with pixel counts
    const brands = useMemo(() => {
        const map = new Map();
        (ownedPixels || []).forEach(p => {
            const name = p.brandName || p.ownerName;
            if (!name) return;
            if (!map.has(name)) map.set(name, { name, count: 0 });
            map.get(name).count++;
        });
        return Array.from(map.values()).sort((a, b) => b.count - a.count);
    }, [ownedPixels]);

    // Filter by search query
    const filtered = useMemo(() => {
        if (!query.trim()) return brands;
        const q = query.toLowerCase();
        return brands.filter(b => b.name.toLowerCase().includes(q));
    }, [brands, query]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = (brandName) => {
        setQuery('');
        setOpen(false);
        if (onSelectBrand) onSelectBrand(brandName);
    };

    return (
        <div ref={ref} className="relative" style={{ minWidth: 200 }}>
            <div className="flex items-center bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <svg className="w-4 h-4 ml-2.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search brands..."
                    className="w-full px-2.5 py-2 text-sm bg-transparent outline-none text-gray-800 placeholder-gray-400"
                />
            </div>

            {open && filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white/95 backdrop-blur-md border border-gray-200 rounded-lg shadow-xl z-50">
                    {filtered.map(brand => (
                        <button
                            key={brand.name}
                            onClick={() => handleSelect(brand.name)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between group"
                        >
                            <span className="text-sm font-medium text-gray-800 group-hover:text-blue-600 truncate">{brand.name}</span>
                            <span className="text-[11px] text-gray-400 font-mono ml-2 shrink-0">{brand.count} px</span>
                        </button>
                    ))}
                </div>
            )}

            {open && filtered.length === 0 && query.trim() && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white/95 backdrop-blur-md border border-gray-200 rounded-lg shadow-xl z-50 p-3">
                    <p className="text-xs text-gray-400 text-center">No brands found</p>
                </div>
            )}
        </div>
    );
}
