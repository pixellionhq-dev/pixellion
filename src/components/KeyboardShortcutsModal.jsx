import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SHORTCUTS = [
    { keys: ['⌘', 'K'],     desc: 'Search brands (Command Palette)' },
    { keys: ['?'],           desc: 'Show / hide this keyboard shortcuts panel' },
    { keys: ['F'],           desc: 'Fit entire board in view' },
    { keys: ['Space', 'Drag'], desc: 'Pan the canvas' },
    { keys: ['Scroll'],      desc: 'Zoom in / out' },
    { keys: ['⌘', 'Scroll'], desc: 'Trackpad pinch zoom' },
    { keys: ['↑ ↓ ← →'],   desc: 'Nudge viewport (50 cells)' },
    { keys: ['Click'],       desc: 'Select empty pixels' },
    { keys: ['Drag'],        desc: 'Select a rectangular area' },
    { keys: ['Dbl-click'],   desc: 'Visit brand website in new tab' },
    { keys: ['Esc'],         desc: 'Close open panels / deselect' },
];

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
    // Esc to close
    useEffect(() => {
        if (!isOpen) return;
        const down = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', down);
        return () => window.removeEventListener('keydown', down);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 bg-black/25 backdrop-blur-[6px] z-[200]"
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: -10 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 340, mass: 0.6 }}
                        className="fixed z-[201] glass-card rounded-2xl shadow-2xl overflow-hidden"
                        style={{
                            top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 'min(480px, 92vw)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle)]">
                            <div>
                                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                                    Keyboard Shortcuts
                                </h2>
                                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                                    Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">?</kbd> to toggle
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 1l10 10M11 1L1 11" />
                                </svg>
                            </button>
                        </div>

                        {/* Shortcuts list */}
                        <div className="py-2 px-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {SHORTCUTS.map((s, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between gap-4 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    <span className="text-[13px] text-[var(--color-text-secondary)]">
                                        {s.desc}
                                    </span>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {s.keys.map((k, ki) => (
                                            <kbd
                                                key={ki}
                                                className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[11px] font-mono text-gray-600 leading-none"
                                            >
                                                {k}
                                            </kbd>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
