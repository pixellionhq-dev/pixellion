import { useMemo, useEffect, useRef, useState } from 'react';

/**
 * ADD 5 — Live scrolling activity ticker at the bottom of the board.
 * Shows recent purchases derived from blocks + brands props.
 */
export default function ActivityTicker({ blocks, brands }) {
    const [visible, setVisible] = useState(false);
    const trackRef = useRef(null);

    const brandNameMap = useMemo(
        () => new Map((brands || []).map(b => [b.brandId, b.brandName])),
        [brands]
    );

    const items = useMemo(() => {
        if (!blocks || blocks.length === 0) return [];
        return blocks.map(b => ({
            id:    b.id,
            brand: brandNameMap.get(b.brandId) || 'Unknown',
            px:    b.width * b.height,
        }));
    }, [blocks, brandNameMap]);

    // Show after 1.5s and only when there's real data
    useEffect(() => {
        if (items.length === 0) return;
        const t = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(t);
    }, [items.length]);

    if (!visible || items.length === 0) return null;

    // Duplicate for seamless looping
    const loopItems = [...items, ...items];

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-[45] pointer-events-none overflow-hidden"
            style={{ height: 32 }}
        >
            <div
                className="absolute inset-0"
                style={{
                    background: 'linear-gradient(to top, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 100%)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                }}
            />
            <div
                ref={trackRef}
                className="flex items-center h-full gap-0"
                style={{
                    animation: `tickerScroll ${Math.max(22, items.length * 6)}s linear infinite`,
                    whiteSpace: 'nowrap',
                }}
            >
                {loopItems.map((item, i) => (
                    <span
                        key={`${item.id}-${i}`}
                        className="inline-flex items-center gap-1.5 px-5"
                        style={{
                            fontSize: 11,
                            color: 'rgba(0,0,0,0.40)',
                            fontWeight: 500,
                            letterSpacing: '-0.01em',
                        }}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        <span className="font-semibold text-black/60">{item.brand}</span>
                        &nbsp;claimed&nbsp;
                        <span className="font-semibold text-black/60">{item.px.toLocaleString()} px</span>
                        <span className="mx-3 text-black/15">·</span>
                    </span>
                ))}
            </div>

            <style>{`
                @keyframes tickerScroll {
                    from { transform: translateX(0); }
                    to   { transform: translateX(-50%); }
                }
            `}</style>
        </div>
    );
}
