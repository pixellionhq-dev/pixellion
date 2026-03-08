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