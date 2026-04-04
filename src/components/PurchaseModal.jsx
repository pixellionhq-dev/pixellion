import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './ui/Button';
import Input from './ui/Input';

export default function PurchaseModal({ isOpen, onClose, onSubmit, selectedCount, pricePerPixel, isPurchasing, purchaseError, setPurchaseError, uploadProgress }) {
    const [brandName, setBrandName] = useState('');
    const [brandUrl, setBrandUrl] = useState('');
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [error, setError] = useState('');

    const handleLogoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowed = ['image/png', 'image/jpeg', 'image/svg+xml'];
        if (!allowed.includes(file.type)) {
            setError('Logo must be PNG, JPG, or SVG');
            return;
        }
        if (file.size > 512 * 1024) {
            setError('Logo must be under 512 KB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            setLogoPreview(ev.target.result);
            setLogoFile(file); // Keep the actual File object for upload
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        if (setPurchaseError) setPurchaseError('');

        if (!brandName.trim()) {
            setError('Brand name is required');
            return;
        }

        if (!brandUrl || !/^https?:\/\/.+/.test(brandUrl)) {
            setError('Please enter a valid website URL starting with http:// or https://');
            return;
        }

        // Pass everything to the parent (PixelBoard), which will handle the upload phase
        onSubmit({ brandName, brandUrl, logoFile });
    };

    const total = selectedCount * pricePerPixel;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -20 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
                >
                    <div className="bg-white/80 backdrop-blur-xl border border-white/40 shadow-sm rounded-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Claim Your Pixels</h3>
                            <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">Provide your brand details to secure this ad space.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Error banners — shown at top so they're immediately visible */}
                            {(purchaseError || error) && (
                                <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
                                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    <span>{purchaseError || error}</span>
                                </div>
                            )}

                            {/* Order Summary */}
                            <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-gray-600">Selected Area</span>
                                    <span className="text-sm font-bold">{selectedCount} pixels</span>
                                </div>
                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                                    <span className="text-sm font-medium text-gray-600">Price per pixel</span>
                                    <span className="text-sm font-bold">₹{pricePerPixel.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-base font-bold text-gray-900">Total Purchase</span>
                                    <span className="text-lg font-bold text-black">₹{total.toLocaleString('en-IN')}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name *</label>
                                <Input
                                    type="text"
                                    value={brandName}
                                    onChange={(e) => setBrandName(e.target.value)}
                                    className="w-full bg-gray-50 transition-all"
                                    placeholder="e.g. Acme Corp"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Website URL *</label>
                                <Input
                                    type="url"
                                    value={brandUrl}
                                    onChange={(e) => setBrandUrl(e.target.value)}
                                    className="w-full bg-gray-50 transition-all"
                                    placeholder="https://acmecorp.com"
                                    required
                                />
                            </div>

                            {/* Logo Upload */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Logo (optional)</label>
                                <div className="flex items-center gap-3">
                                    {logoPreview ? (
                                        <img src={logoPreview} alt="Logo preview" className="w-10 h-10 rounded-lg object-contain border border-gray-200 bg-white" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-lg">
                                            +
                                        </div>
                                    )}
                                    <label className="cursor-pointer">
                                        <span className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
                                            {logoPreview ? 'Change logo' : 'Upload PNG, JPG, or SVG'}
                                        </span>
                                        <input
                                            type="file"
                                            accept=".png,.jpg,.jpeg,.svg"
                                            onChange={handleLogoChange}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="pt-4 flex flex-col gap-3">
                                {isPurchasing && uploadProgress > 0 && (
                                    <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 transition-all duration-300 ease-out"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                )}
                                <div className="flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <Button
                                        type="submit"
                                        disabled={isPurchasing}
                                        className="bg-black text-white px-6 py-2.5 rounded-lg font-medium text-sm shadow-sm hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                                    >
                                        {isPurchasing ? (
                                            <>
                                                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                                                Processing...
                                            </>
                                        ) : (
                                            'Confirm Purchase'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
