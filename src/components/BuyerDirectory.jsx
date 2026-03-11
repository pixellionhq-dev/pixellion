import { useState } from 'react';
import { useDirectory } from '../hooks/useBuyers';
import Card from './ui/Card';

const COUNTRIES = ['All', 'US', 'KR', 'SE', 'CA', 'GB', 'AU', 'JP', 'DE', 'FR'];

export default function BuyerDirectory() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCountry, setSelectedCountry] = useState('All');

    // API call automatically refetches when searchTerm or selectedCountry changes (with a slight delay or depending on react-query config)
    const { data: buyers, isLoading } = useDirectory(searchTerm, selectedCountry);

    return (
        <section id="directory" className="px-6 py-20 max-w-6xl mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
                        Buyer Directory
                    </h2>
                    <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
                        Explore the prestigious brands that own pixels.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search brands..."
                            className="search-input pl-9 w-full focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Country Filter */}
                    <div className="relative w-full sm:w-32">
                        <select
                            className="filter-select w-full"
                            value={selectedCountry}
                            onChange={(e) => setSelectedCountry(e.target.value)}
                        >
                            {COUNTRIES.map(country => (
                                <option key={country} value={country}>{country === 'All' ? 'All Regions' : country}</option>
                            ))}
                        </select>
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {isLoading ? (
                    <div className="col-span-full py-20 text-center text-sm text-[var(--color-text-tertiary)] animate-pulse">
                        Loading directory...
                    </div>
                ) : buyers && buyers.length > 0 ? (
                    buyers.map((buyer, index) => (
                        <Card key={buyer.brand} className={`group p-6 bg-white border-t-[3px] stagger-${(index % 10) + 1}`} style={{ borderTopColor: buyer.color, boxShadow: 'var(--shadow-card)' }}>
                            <div className="flex items-start justify-between mb-4">
                                <div
                                    className="w-12 h-12 rounded-full shadow-sm relative overflow-hidden transition-transform duration-300 group-hover:scale-105 flex items-center justify-center"
                                    style={{ backgroundColor: buyer.color, boxShadow: `0 -2px 20px ${buyer.color}20` }}
                                >
                                    <span className="text-white font-bold text-base">{buyer.brand.slice(0, 2).toUpperCase()}</span>
                                </div>
                                <span title={buyer.country} className="text-lg bg-[var(--color-surface-hover)] px-1.5 py-0.5 rounded-md border border-[var(--color-border)] cursor-default transition-colors group-hover:bg-white">
                                    {buyer.flag}
                                </span>
                            </div>

                            <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1 group-hover:text-black transition-colors">
                                {buyer.brand}
                            </h3>

                            <div className="flex flex-col gap-1.5 mt-4 pt-4 border-t border-[var(--color-border)]">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-[var(--color-text-tertiary)]">Owned Pixels</span>
                                    <span className="text-xl font-bold text-[var(--color-text-primary)] font-mono leading-none">{buyer.pixels.toLocaleString()} <span className="text-xs font-medium text-[var(--color-text-tertiary)]">px</span></span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-[var(--color-text-tertiary)]">Joined</span>
                                    <span className="text-xs font-medium text-[var(--color-text-secondary)] px-2.5 py-1 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)]">{new Date(buyer.joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                                </div>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface-elevated)]/50">
                        <svg className="w-8 h-8 text-[var(--color-text-tertiary)] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                        <h4 className="text-base font-semibold text-[var(--color-text-primary)]">No brands found</h4>
                        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Try adjusting your search or filters.</p>
                        <button
                            onClick={() => { setSearchTerm(''); setSelectedCountry('All'); }}
                            className="mt-4 text-[13px] font-medium text-[var(--color-accent)] hover:underline"
                        >
                            Clear all filters
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
