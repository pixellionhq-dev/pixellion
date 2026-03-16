import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../constants/canvasConfig';

export default function BrandProfile() {
    const { brandName } = useParams();
    const [brandData, setBrandData] = useState(null);

    // Fetch all pixels to aggregate profile data (simulating a dedicated profile endpoint for now)
    const { data: pixels = [], isLoading } = useQuery({
        queryKey: ['pixels'],
        queryFn: async () => {
            const res = await apiClient.get('/pixels', {
                params: {
                    minX: 0,
                    minY: 0,
                    maxX: BOARD_WIDTH - 1,
                    maxY: BOARD_HEIGHT - 1,
                },
            });
            return res.data;
        }
    });

    useEffect(() => {
        if (pixels.length > 0 && brandName) {
            const decodedName = decodeURIComponent(brandName);
            const ownedByBrand = pixels.filter(p => p.ownerName === decodedName);

            if (ownedByBrand.length > 0) {
                // Determine logo (prefer first valid uploaded logo, fallback to URL)
                const logo = ownedByBrand.find(p => p.ownerLogo)?.ownerLogo || ownedByBrand.find(p => p.logoUrl)?.logoUrl;
                const url = ownedByBrand.find(p => p.ownerUrl)?.ownerUrl;

                setBrandData({
                    name: decodedName,
                    pixelCount: ownedByBrand.length,
                    logo: logo ? (logo.startsWith('http') ? logo : `http://localhost:3001/uploads/${logo.split('/').pop()}`) : null,
                    url: url,
                    rank: ownedByBrand[0].ownerRank || '-', // Note: Rank might need a real leaderboard calc
                    joinedDate: new Date(ownedByBrand[0].createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                });
            }
        }
    }, [pixels, brandName]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium">Loading Profile...</p>
                </div>
            </div>
        );
    }

    if (!brandData && !isLoading) {
        return (
            <div className="min-h-screen bg-[var(--color-surface)] flex flex-col items-center justify-center gap-6">
                <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Brand Not Found</h1>
                <p className="text-gray-500">We couldn't locate any pixels owned by "{brandName}".</p>
                <Link to="/" className="text-[var(--color-accent)] hover:text-blue-700 font-medium">← Back to Board</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-surface)] pt-24 pb-16 px-6">
            <Link to="/" className="fixed top-8 left-8 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] font-medium z-50 transition-colors">
                ← Back to Board
            </Link>

            <div className="max-w-4xl mx-auto space-y-12">
                {/* Profile Header UI */}
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8 bg-white p-8 rounded-3xl border border-gray-200/50 shadow-sm">
                    {brandData.logo ? (
                        <img
                            src={brandData.logo}
                            alt={`${brandData.name} logo`}
                            className="w-32 h-32 object-contain rounded-2xl shadow-sm border border-gray-100 bg-white"
                        />
                    ) : (
                        <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 flex items-center justify-center shadow-sm">
                            <span className="text-4xl font-bold text-blue-600">
                                {brandData.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}

                    <div className="flex flex-col items-center md:items-start flex-1 gap-4 text-center md:text-left">
                        <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">{brandData.name}</h1>
                        <p className="text-lg text-gray-500 max-w-lg leading-relaxed">
                            Official advertising partner on the Pixellion grid. Discover their ecosystem and explore their products directly.
                        </p>
                        {brandData.url && (
                            <a
                                href={brandData.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full px-8 py-3 transition-all transform hover:scale-[1.02] shadow-[0_4px_14px_0_rgba(37,99,235,0.39)]"
                            >
                                Visit Website
                            </a>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white border border-gray-200/50 shadow-[0_4px_20px_rgb(0,0,0,0.03)] rounded-2xl p-6 flex flex-col gap-2 transition-transform hover:-translate-y-1">
                        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Pixels Owned</span>
                        <span className="text-4xl font-bold text-gray-900">{brandData.pixelCount.toLocaleString()}</span>
                        <span className="text-xs text-gray-400 mt-2">Active on board</span>
                    </div>

                    <div className="bg-white border border-gray-200/50 shadow-[0_4px_20px_rgb(0,0,0,0.03)] rounded-2xl p-6 flex flex-col gap-2 transition-transform hover:-translate-y-1">
                        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Leaderboard Rank</span>
                        <span className="text-4xl font-bold text-blue-600">#{brandData.rank}</span>
                        <span className="text-xs text-gray-400 mt-2">By total volume</span>
                    </div>

                    <div className="bg-white border border-gray-200/50 shadow-[0_4px_20px_rgb(0,0,0,0.03)] rounded-2xl p-6 flex flex-col gap-2 transition-transform hover:-translate-y-1">
                        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Joined Date</span>
                        <span className="text-2xl font-bold text-gray-900 mt-2">{brandData.joinedDate}</span>
                        <span className="text-xs text-gray-400 mt-2">Initial investment</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
