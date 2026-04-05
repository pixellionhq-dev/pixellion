import { useEffect, useState } from 'react';
import { getPixels } from '../api/pixels';

const DEBOUNCE_MS = 250;

let viewport = null;
let blocks = [];
let brands = [];
let loading = false;
let error = null;
let timer = null;
let currentRequest = null;
let lastKey = '';
const listeners = new Set();

function emit() {
    listeners.forEach((listener) => listener());
}

function keyFor(vp) {
    if (!vp) return '';
    return `${vp.minX}:${vp.minY}:${vp.maxX}:${vp.maxY}`;
}

function setState(next) {
    viewport = next.viewport ?? viewport;
    blocks = next.blocks ?? blocks;
    brands = next.brands ?? brands;
    loading = next.loading ?? false;
    error = next.error ?? null;
    emit();
}

async function fetchViewport(vp) {
    if (!vp) return;

    const nextKey = keyFor(vp);
    if (nextKey === lastKey) return;

    if (currentRequest) {
        currentRequest.abort();
    }

    const controller = new AbortController();
    currentRequest = controller;
    setState({ viewport: vp, loading: true, error: null });

    try {
        const data = await getPixels(vp, { signal: controller.signal });
        if (currentRequest !== controller) return;

        const payloadBlocks = Array.isArray(data?.blocks) ? data.blocks : [];
        const payloadBrands = Array.isArray(data?.brands) ? data.brands : [];

        blocks = payloadBlocks;
        brands = payloadBrands;
        loading = false;
        error = null;
        lastKey = nextKey;
        // FIX 4 — Audit: log first 3 brands to verify logoUrl is in API response
        if (payloadBrands.length > 0) {
            console.log('BRANDS FROM API (sample):', payloadBrands.slice(0, 3).map(b => ({
                brandId: b.brandId, brandName: b.brandName, logoUrl: b.logoUrl, url: b.url,
            })));
        }
        emit();
    } catch (err) {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
            return;
        }
        setState({ loading: false, error: err?.message || 'Viewport fetch failed' });
    }
}

export function setPixelViewport(nextViewport) {
    viewport = nextViewport;

    if (timer) {
        clearTimeout(timer);
        timer = null;
    }

    timer = setTimeout(() => {
        timer = null;
        void fetchViewport(nextViewport);
    }, DEBOUNCE_MS);
}

export function refreshPixelViewport() {
    if (!viewport) return;
    lastKey = '';
    void fetchViewport(viewport);
}

export default function usePixelViewport() {
    const [, setTick] = useState(0);

    useEffect(() => {
        const listener = () => setTick((value) => value + 1);
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    return {
        viewport,
        blocks,
        brands,
        loading,
        error,
        setViewport: setPixelViewport,
        refresh: refreshPixelViewport,
    };
}
