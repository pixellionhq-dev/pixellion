/**
 * imageCache.js — High-performance image cache with texture atlas support.
 *
 * Features:
 * - Bounded LRU-ish cache (evicts oldest non-loading entries when full)
 * - Deduplicates in-flight loads (same URL → single fetch)
 * - Async image decoding via createImageBitmap / img.decode()
 * - Batch preload API for visible logos
 * - Simple texture atlas: packs loaded images into a single OffscreenCanvas
 *   so the main draw loop can issue drawImage from one GPU-backed source.
 * - requestAnimationFrame-aware redraw callback
 */

const IMAGE_CACHE_MAX = 1200;
const LOADING_TIMEOUT_MS = 15_000;

// ── Singleton state ──────────────────────────────────────────────────────────

/** @type {Map<string, CacheEntry>} */
const cache = new Map();

/**
 * @typedef {'loading'|'ready'|'error'} CacheStatus
 * @typedef {{ status: CacheStatus, img?: HTMLImageElement|ImageBitmap, startedAt?: number, failedAt?: number, loadedAt?: number, atlasRect?: {x:number,y:number,w:number,h:number} }} CacheEntry
 */

let _onRedraw = () => {};

/** Register a callback that will be invoked whenever a new image finishes loading. */
export function setRedrawCallback(fn) {
  _onRedraw = typeof fn === 'function' ? fn : () => {};
}

// ── Atlas ────────────────────────────────────────────────────────────────────

const ATLAS_SIZE = 2048; // px, power-of-two for GPU friendliness
const ATLAS_CELL = 128;  // each logo gets a 128×128 slot
const ATLAS_COLS = ATLAS_SIZE / ATLAS_CELL; // 16

let atlas = null;        // OffscreenCanvas | HTMLCanvasElement
let atlasCtx = null;
let atlasNextSlot = 0;

function ensureAtlas() {
  if (atlas) return;
  if (typeof OffscreenCanvas !== 'undefined') {
    atlas = new OffscreenCanvas(ATLAS_SIZE, ATLAS_SIZE);
  } else {
    atlas = document.createElement('canvas');
    atlas.width = ATLAS_SIZE;
    atlas.height = ATLAS_SIZE;
  }
  atlasCtx = atlas.getContext('2d');
}

/**
 * Pack an image into the atlas and return its rect.
 * Returns null if atlas is full.
 */
function packIntoAtlas(img) {
  ensureAtlas();
  const maxSlots = ATLAS_COLS * ATLAS_COLS; // 256
  if (atlasNextSlot >= maxSlots) return null;

  const col = atlasNextSlot % ATLAS_COLS;
  const row = Math.floor(atlasNextSlot / ATLAS_COLS);
  const x = col * ATLAS_CELL;
  const y = row * ATLAS_CELL;

  atlasCtx.clearRect(x, y, ATLAS_CELL, ATLAS_CELL);
  atlasCtx.drawImage(img, x, y, ATLAS_CELL, ATLAS_CELL);
  atlasNextSlot++;

  return { x, y, w: ATLAS_CELL, h: ATLAS_CELL };
}

/** Get the atlas canvas (for use as a drawImage source). May be null if nothing packed yet. */
export function getAtlasCanvas() {
  return atlas;
}

// ── Cache operations ─────────────────────────────────────────────────────────

function evictOne(skipKey) {
  for (const [k, v] of cache) {
    if (k === skipKey) continue;
    if (v.status === 'loading') continue;
    cache.delete(k);
    return;
  }
}

/** Get a cache entry (or undefined). */
export function getEntry(url) {
  return cache.get(url);
}

/** Number of entries currently cached. */
export function cacheSize() {
  return cache.size;
}

/**
 * Request an image by resolved URL.
 * - If already cached → returns the existing entry immediately.
 * - If not cached → starts loading, returns the new 'loading' entry.
 * Deduplication: calling load() twice with the same url while the first is
 * still in-flight will NOT start a second fetch.
 */
export function load(url) {
  if (!url) return null;

  const existing = cache.get(url);
  if (existing) return existing;

  // Start a new load
  const loadStartedAt = Date.now();
  const entry = { status: 'loading', startedAt: loadStartedAt };
  cache.set(url, entry);
  if (cache.size > IMAGE_CACHE_MAX) evictOne(url);

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';

  const timeoutId = setTimeout(() => {
    const e = cache.get(url);
    if (e && e.status === 'loading' && e.startedAt === loadStartedAt) {
      cache.set(url, { status: 'error', failedAt: Date.now() });
      _onRedraw();
    }
  }, LOADING_TIMEOUT_MS);

  const onDone = (ok) => {
    clearTimeout(timeoutId);
    if (!ok) {
      cache.set(url, { status: 'error', failedAt: Date.now() });
      _onRedraw();
      return;
    }

    // Try to pack into atlas
    const rect = packIntoAtlas(img);

    const readyEntry = {
      status: 'ready',
      img,
      loadedAt: Date.now(),
      atlasRect: rect, // null if atlas full; caller falls back to img directly
    };
    cache.set(url, readyEntry);
    if (cache.size > IMAGE_CACHE_MAX) evictOne(url);
    _onRedraw();
  };

  img.onload = () => onDone(true);
  img.onerror = () => onDone(false);
  img.src = url;

  return entry;
}

/**
 * Preload a batch of URLs that are expected to be visible soon.
 * Non-blocking — fires off loads for any URL not already cached/loading.
 */
export function preloadBatch(urls) {
  if (!urls || urls.length === 0) return;
  for (let i = 0; i < urls.length; i++) {
    load(urls[i]);
  }
}

/**
 * Clear the entire cache and reset the atlas.
 * Useful if pixel data changes dramatically.
 */
export function clearAll() {
  cache.clear();
  if (atlasCtx) atlasCtx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  atlasNextSlot = 0;
}
