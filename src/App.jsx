import React, { useEffect, useRef, useState } from 'react';
import PixelBoard from './components/PixelBoard';
import Pulse from './components/Pulse';
import ShaderBackground from './components/ShaderBackground';
import HUD from './components/HUD';
import CommandPalette from './components/CommandPalette';
import ShaderIntro from './components/ShaderIntro';
import HeroOverlay from './components/HeroOverlay';
import ActivityTicker from './components/ActivityTicker';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import usePixelViewport from './store/usePixelViewport';

export default function App() {
  const [pulseEvents, setPulseEvents] = useState([]);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── Intro: gated by sessionStorage ───────────────────────────────────────
  const [showIntro, setShowIntro] = useState(
    () => !sessionStorage.getItem('px_intro_seen')
  );

  // ── Hero: hash-based routing so browser Back button works ────────────────
  // #board  → show canvas
  // '' / #home → show hero (if intro is done)
  const [hashLoc, setHashLoc] = useState(() => window.location.hash);

  useEffect(() => {
    const onHash = () => setHashLoc(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Show hero whenever: intro is done AND hash isn't '#board'
  const showHero = !showIntro && hashLoc !== '#board';

  const knownPurchaseIds   = useRef(new Set());
  const hasPrimedPurchases = useRef(false);
  const { blocks, brands, refresh } = usePixelViewport();

  // Dark-mode watcher
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (dark) => {
      document.documentElement.classList.toggle('dark', dark);
    };
    apply(mq.matches);
    mq.addEventListener('change', e => apply(e.matches));
    return () => mq.removeEventListener('change', () => {});
  }, []);

  // Periodic refresh
  useEffect(() => {
    const id = setInterval(() => refresh(), 30_000);
    return () => clearInterval(id);
  }, []);

  // Pulse events from new purchases
  useEffect(() => {
    const brandNameMap = new Map((brands || []).map(b => [b.brandId, b.brandName]));
    const purchases = (blocks || []).map(block => ({
      id:     block.id,
      brand:  brandNameMap.get(block.brandId) || block.brandId || 'Unknown Brand',
      pixels: block.width * block.height,
      color:  '#2563eb',
    }));

    if (!hasPrimedPurchases.current) {
      purchases.forEach(p => knownPurchaseIds.current.add(p.id));
      hasPrimedPurchases.current = true;
      return;
    }

    const newPurchases = purchases.filter(p => !knownPurchaseIds.current.has(p.id));
    newPurchases.forEach(p => knownPurchaseIds.current.add(p.id));

    if (newPurchases.length > 0) {
      const events = newPurchases.map(p => ({
        id:     `${p.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        brand:  p.brand,
        pixels: p.pixels,
        color:  p.color,
        time:   Date.now(),
      }));
      setPulseEvents(prev => [...prev, ...events].slice(-10));
    }
  }, [blocks, brands]);

  // '?' key → keyboard shortcuts modal
  useEffect(() => {
    const down = e => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        setShowShortcuts(s => !s);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden fixed top-0 left-0 bg-transparent z-0">
      {showIntro && <ShaderIntro onDone={() => setShowIntro(false)} />}
      {showHero  && (
        <HeroOverlay
          onDismiss={() => {
            // hash is already set to '#board' inside HeroOverlay.dismiss()
            setHashLoc('#board');
          }}
        />
      )}

      <ShaderBackground />

      {/* Universal Fullscreen Canvas */}
      <main className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-10">
        <PixelBoard leaderboardOpen={leaderboardOpen} />
      </main>

      {/* Floating HUD Layer */}
      <HUD
        leaderboardOpen={leaderboardOpen}
        onToggleLeaderboard={() => setLeaderboardOpen(p => !p)}
        onShowShortcuts={() => setShowShortcuts(true)}
      />

      {/* Global Command Centre */}
      <CommandPalette
        onSelectBrand={brand =>
          document.dispatchEvent(
            new CustomEvent('map:zoomToBrand', { detail: brand.brandId })
          )
        }
      />

      {/* Activity ticker */}
      <ActivityTicker blocks={blocks} brands={brands} />

      {/* Keyboard shortcuts overlay */}
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      <Pulse events={pulseEvents} />
    </div>
  );
}
