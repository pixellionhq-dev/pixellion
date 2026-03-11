import { useEffect, useRef, useState } from 'react';

export default function Pulse({ events }) {
  const [active, setActive] = useState([]);
  const seenIds = useRef(new Set());

  useEffect(() => {
    if (!events || events.length === 0) return;

    const timeouts = [];
    events.forEach((e) => {
      if (!e?.id || seenIds.current.has(e.id)) return;

      seenIds.current.add(e.id);
      setActive((prev) => [...prev, e].slice(-3));

      const timeoutId = setTimeout(() => {
        setActive((prev) => prev.filter((item) => item.id !== e.id));
        seenIds.current.delete(e.id);
      }, 6000);

      timeouts.push(timeoutId);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [events]);

  const visible = active.slice(-3);
  if (visible.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-end'
      }}
    >
      {visible.map((e) => (
        <div
          key={e.id}
          className="pulse-item animate-slide-in-up"
          style={{
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 100,
            padding: '8px 16px 8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            whiteSpace: 'nowrap'
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: e.color,
              flexShrink: 0
            }}
          />
          {e.brand} claimed {e.pixels.toLocaleString()} px
        </div>
      ))}
    </div>
  );
}
