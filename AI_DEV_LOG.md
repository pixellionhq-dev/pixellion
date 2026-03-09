4"}
PIXELLION AI DEVELOPMENT LOG

Purpose:
Track all AI changes so Antigravity and other agents understand project history.

Format:

DATE
AI TOOL USED
FILES MODIFIED
DESCRIPTION OF CHANGE
REASON

Example

2026-03-09
Tool: Copilot
Files Modified:
src/api/client.js

Change:
Connected frontend API client to Render backend URL.

Reason:
Frontend was previously pointing to localhost

2026-03-09
AI TOOL USED
Copilot (GPT-5.3-Codex)
FILES MODIFIED
src/hooks/usePixels.js
src/components/PixelBoard.jsx
AI_DEV_LOG.md
DESCRIPTION OF CHANGE
Forwarded fitMode, imageWidth, and imageHeight through the usePixels purchase mutation into purchasePixels so metadata reaches the backend. Added fit-aware canvas logo rendering for contain, cover, and fill in PixelBoard using stored metadata fields. Replaced hardcoded localhost upload fallback with environment-safe logo URL resolution based on API base URL. Added image onerror cache handling to mark failed logo loads and avoid persistent loading states. Added pointer-capture safety checks before releasePointerCapture to reduce Safari pointer-capture issues.
REASON
Phase 1 safe stability and rendering fixes to improve logo display quality, loading reliability, and cross-browser interaction behavior without changing architecture, response shapes, query keys, or invalidation flow.

2026-03-09
AI TOOL USED
Copilot (GPT-5.3-Codex)
FILES MODIFIED
src/components/PixelBoard.jsx
AI_DEV_LOG.md
DESCRIPTION OF CHANGE
Phase 1 performance: added memoized precomputed block geometry from ownedPixels and updated drawBaseBoard to use visible precomputed blocks instead of rebuilding purchase grouping and per-block min/max values on each frame.
REASON
Reduce per-frame CPU work during pan/zoom by moving grouping and geometry calculations to data-change time.

2026-03-09
AI TOOL USED
Copilot (GPT-5.3-Codex)
FILES MODIFIED
src/components/PixelBoard.jsx
AI_DEV_LOG.md
DESCRIPTION OF CHANGE
Phase 2 performance: optimized pointer move state updates by preventing redundant setCursorPos, setTooltipPos, setCursorNearMinimap, and setHoveredPixel calls when values are unchanged.
REASON
Lower React render churn during high-frequency pointer movement to improve drag and hover smoothness.

2026-03-09
AI TOOL USED
Copilot (GPT-5.3-Codex)
FILES MODIFIED
src/components/PixelBoard.jsx
AI_DEV_LOG.md
DESCRIPTION OF CHANGE
Phase 3 performance: added grid density guards in drawBaseBoard to skip grid levels that would render excessive line counts at the current zoom/viewport.
REASON
Reduce canvas path and stroke overhead when zoom is far out or visible grid density is high.

2026-03-09
AI TOOL USED
Copilot (GPT-5.3-Codex)
FILES MODIFIED
src/components/PixelBoard.jsx
AI_DEV_LOG.md
DESCRIPTION OF CHANGE
Phase 4 performance: cached per-frame visible block screen-space rectangles (tl/br/width/height) and reused them across background and logo rendering passes, while keeping logo draws restricted to visible blocks.
REASON
Reduce repeated transform and geometry computations during board redraws.

2026-03-09
AI TOOL USED
Copilot (GPT-5.3-Codex)
FILES MODIFIED
src/components/PixelBoard.jsx
AI_DEV_LOG.md
DESCRIPTION OF CHANGE
Phase 5 performance: replaced overlapping per-layer redraw scheduling with a single coalesced requestAnimationFrame scheduler for base and overlay canvases. Updated image-load and pointer-triggered redraw paths to use the shared scheduler and added cleanup for pending scheduled frames.
REASON
Stabilize frame pacing and prevent redundant redraw work from concurrent RAF sources during interaction and image loading.

2026-03-09
AI TOOL USED
Copilot (GPT-5.3-Codex)
FILES MODIFIED
src/components/PixelBoard.jsx
AI_DEV_LOG.md
DESCRIPTION OF CHANGE
Fixed cross-browser drag robustness by hardening canvas input handling with pointer safeguards, global pointer move/up capture support, mouse fallback for non-pointer environments, and touchstart/touchmove/touchend/touchcancel fallback routing for Safari/mobile Safari. Updated mouse leave behavior to avoid prematurely ending active drags. Fixed logo loading path by improving resolveLogoUrl to preserve blob/data URLs and normalize absolute localhost/127.0.0.1 URLs to the configured API base URL while retaining non-local absolute URLs.
REASON
Ensure stable drag/pan behavior across Safari/Chrome/Firefox/mobile Safari and restore reliable board logo loading in production without changing architecture or backend API shapes.

2026-03-09
AI TOOL USED
Copilot (GPT-5.3-Codex)
FILES MODIFIED
src/components/PixelBoard.jsx
AI_DEV_LOG.md
DESCRIPTION OF CHANGE
Improved logo loading speed and reliability on PixelBoard by normalizing logo URLs with API base plus optional R2/CDN public base support, rewriting localhost absolute URLs to production-safe endpoints, and preserving blob/data URLs. Updated image cache behavior to deduplicate by normalized URL, add async decode hints, enforce loading timeout fail-safe to avoid stuck loading state, mark errors explicitly, trigger redraw on load/error, and keep cache lightweight with bounded size eviction.
REASON
Ensure logos display correctly on all deployments and never get stuck in loading state; reduce redundant network fetches.

---

2026-03-09
AI TOOL USED
GitHub Copilot (Claude Opus 4.6)
FILES MODIFIED
src/utils/imageCache.js (new)
src/components/PixelBoard.jsx
AI_DEV_LOG.md
DESCRIPTION OF CHANGE
Problem 1 — Logo loading speed:
Created src/utils/imageCache.js — shared singleton image cache with bounded LRU eviction (1200 max), deduplication of in-flight loads, 15s timeout fail-safe, async decode, and a simple texture atlas (2048x2048 OffscreenCanvas, 128x128 slots, 256 logos) for GPU-friendly batch drawing.
Replaced inline imageCache ref in PixelBoard with the new ImageCache module. Draw loop now prefers atlas drawImage (single GPU texture source) with fallback to per-image drawLogoWithFit.
Added preloadBatch effect so all logo URLs from precomputedBlocks are preloaded on pixel data change.
Wired ImageCache.setRedrawCallback to scheduleRedraw so images trigger repaint on load/error.

Problem 2 — Mobile navigation:
Implemented full touch gesture system in PixelBoard with a state machine (touchState ref).
One finger tap selects pixel (via 80ms disambiguation timer).
One finger drag pans canvas (promoted from waiting when movement exceeds 8px).
Two finger drag pans canvas (handled via pinch handler midpoint tracking).
Pinch gesture zooms canvas (distance-ratio based, keeps midpoint board-space anchor stable).
Pinch to lift one finger transitions seamlessly to one-finger pan.
All gestures prevent page scroll via preventDefault.
MiniMap stays synced through existing camera ref plus clampCamera plus scheduleRedraw pipeline.

Problem 3 — Platform independence:
Pointer events remain primary input system (mouse plus stylus plus desktop).
Touch events handled separately via dedicated gesture handlers (not proxied through pointer shims).
Mouse events remain as fallback for browsers without PointerEvent support.
Added Safari trackpad gesture support (gesturestart/gesturechange events).
Improved wheel handler: detects ctrlKey (trackpad pinch translated by browser) for smooth pinch-to-zoom.
Desktop behavior completely unchanged.

REASON
Logos loaded slowly due to per-frame fetching without preloading or atlas batching. Mobile users could not pan/zoom because touch events were forced through single-finger mouse shims. Platform inconsistency across Safari trackpad, desktop mouse, mobile touch, and tablet stylus required unified but separate input handling.
Ensure production-safe logo resolution and faster repeated canvas renders while preventing duplicate loads and non-terminating loading states.