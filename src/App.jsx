import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import PixelBoard from './components/PixelBoard';
import StatsPanel from './components/StatsPanel';
import Leaderboard from './components/Leaderboard';
import BuyerDirectory from './components/BuyerDirectory';
import BrandProfile from './components/BrandProfile';
import Pulse from './components/Pulse';
import { apiClient } from './api/client';

export default function App() {
  const [pulseEvents, setPulseEvents] = useState([]);
  const knownPurchaseIds = useRef(new Set());
  const hasPrimedPurchases = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Set initial mode
    if (mediaQuery.matches) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    // Listen for system changes
    const handler = (e) => {
      if (e.matches) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    let mounted = true;

    const pollPixels = async () => {
      try {
        const res = await apiClient.get('/pixels');
        const pixels = Array.isArray(res.data) ? res.data : [];

        const groups = new Map();
        pixels.forEach((p) => {
          const purchaseId = p.purchaseId;
          if (!purchaseId) return;
          const existing = groups.get(purchaseId);
          if (!existing) {
            groups.set(purchaseId, {
              id: purchaseId,
              brand: p.ownerName || 'Unknown Brand',
              pixels: 1,
              color: p.color || '#2563eb'
            });
          } else {
            existing.pixels += 1;
          }
        });

        const purchases = Array.from(groups.values());

        if (!hasPrimedPurchases.current) {
          purchases.forEach((p) => knownPurchaseIds.current.add(p.id));
          hasPrimedPurchases.current = true;
          return;
        }

        const newPurchases = purchases.filter((p) => !knownPurchaseIds.current.has(p.id));
        newPurchases.forEach((p) => knownPurchaseIds.current.add(p.id));

        if (newPurchases.length > 0 && mounted) {
          const createdEvents = newPurchases.map((p) => ({
            id: `${p.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            brand: p.brand,
            pixels: p.pixels,
            color: p.color,
            time: Date.now()
          }));

          setPulseEvents((prev) => [...prev, ...createdEvents].slice(-10));
        }
      } catch {
        // Keep polling quietly.
      }
    };

    pollPixels();
    const intervalId = setInterval(pollPixels, 30_000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={
            <>
              <Hero />
              <PixelBoard />
              <StatsPanel />
              <Leaderboard />
              <BuyerDirectory />
            </>
          } />
          <Route path="/brand/:brandName" element={<BrandProfile />} />
        </Routes>
        <Pulse events={pulseEvents} />
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border-subtle)] py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[var(--color-text-primary)] flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="5" rx="1" fill="white" />
                <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity="0.6" />
                <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity="0.6" />
                <rect x="9" y="9" width="5" height="5" rx="1" fill="white" opacity="0.3" />
              </svg>
            </div>
            <span className="text-sm font-medium text-[var(--color-text-tertiary)]">
              Pixellion
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            © 2024 Pixellion. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
