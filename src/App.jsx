import React, { useEffect, useRef, useState } from 'react';
import PixelBoard from './components/PixelBoard';
import Pulse from './components/Pulse';
import ShaderBackground from './components/ShaderBackground';
import HUD from './components/HUD';
import CommandPalette from './components/CommandPalette';
import usePixelViewport from './store/usePixelViewport';

export default function App() {
  const [pulseEvents, setPulseEvents] = useState([]);
  const knownPurchaseIds = useRef(new Set());
  const hasPrimedPurchases = useRef(false);
  const { blocks, brands, refresh } = usePixelViewport();

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    if (mediaQuery.matches) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    const handler = (e) => {
      if (e.matches) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => refresh(), 30_000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const brandNameMap = new Map((brands || []).map((b) => [b.brandId, b.brandName]));
    const purchases = (blocks || []).map((block) => ({
      id: block.id,
      brand: brandNameMap.get(block.brandId) || block.brandId || 'Unknown Brand',
      pixels: block.width * block.height,
      color: '#2563eb',
    }));

    if (!hasPrimedPurchases.current) {
      purchases.forEach((p) => knownPurchaseIds.current.add(p.id));
      hasPrimedPurchases.current = true;
      return;
    }

    const newPurchases = purchases.filter((p) => !knownPurchaseIds.current.has(p.id));
    newPurchases.forEach((p) => knownPurchaseIds.current.add(p.id));

    if (newPurchases.length > 0) {
      const createdEvents = newPurchases.map((p) => ({
        id: `${p.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        brand: p.brand,
        pixels: p.pixels,
        color: p.color,
        time: Date.now(),
      }));
      setPulseEvents((prev) => [...prev, ...createdEvents].slice(-10));
    }
  }, [blocks, brands]);

  return (
    <div className="w-screen h-screen overflow-hidden fixed top-0 left-0 bg-transparent z-0">
      <ShaderBackground />
      
      {/* Universal Fullscreen Canvas */}
      <main className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-10">
         <PixelBoard />
      </main>

      {/* Floating HUD Layer */}
      <HUD />
      
      {/* Global Command Center */}
      <CommandPalette onSelectBrand={(brand) => {
         document.dispatchEvent(new CustomEvent('map:zoomToBrand', { detail: brand.brandId }));
      }} />

      <Pulse events={pulseEvents} />
    </div>
  );
}
