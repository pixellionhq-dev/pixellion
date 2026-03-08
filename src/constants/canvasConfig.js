// Board dimensions
export const BOARD_WIDTH = 1000;
export const BOARD_HEIGHT = 1000;
export const TOTAL_PIXELS = BOARD_WIDTH * BOARD_HEIGHT;

// Legacy alias (used in some components for square board reference)
export const BOARD_SIZE = BOARD_WIDTH;

// Zoom limits
export const MIN_ZOOM = 0.4;   // Will be overridden to fit-to-viewport at runtime
export const MAX_ZOOM = 10;
export const DEFAULT_ZOOM = 1;

// Grid rendering
// Dynamic grid levels — drawn from coarsest to finest.
// Each level: { step, color, lineWidth, minCellScreen }
//   step = draw a line every N board cells
//   minCellScreen = only draw this level when zoom * step >= this many screen px
export const GRID_LEVELS = [
    { step: 100, color: 'rgba(0,0,0,0.14)', lineWidth: 1.0, minCellScreen: 2 },
    { step: 50, color: 'rgba(0,0,0,0.12)', lineWidth: 0.8, minCellScreen: 3 },
    { step: 10, color: 'rgba(0,0,0,0.08)', lineWidth: 0.5, minCellScreen: 3 },
    { step: 1, color: 'rgba(0,0,0,0.06)', lineWidth: 0.5, minCellScreen: 4 },
];

// Faint overlay grid drawn OVER logos (only at fine zoom)
export const GRID_OVERLAY_COLOR = 'rgba(0,0,0,0.04)';
export const GRID_OVERLAY_MIN_CELL = 6;

// Hover styling
export const HOVER_COLOR = "rgba(37,99,235,0.2)";
export const HOVER_GLOW_COLOR = "rgba(0, 150, 255, 0.5)";
export const HOVER_BORDER_COLOR = "rgba(255, 255, 255, 0.8)";

// Selection styling
export const SELECTION_COLOR = "rgba(59, 130, 246, 0.4)";
export const SELECTION_BORDER_COLOR = "#2563eb";

// Drag styling
export const DRAG_BG_COLOR = "rgba(59, 130, 246, 0.25)";
