import { apiClient } from '../api/client';

/**
 * Resolves a raw logo path/URL to a fully-qualified URL suitable for use in
 * <img src> or CSS background-image. Handles:
 *  - blob: / data: URLs (pass-through)
 *  - Absolute localhost URLs → rewritten to API base
 *  - R2 CDN paths (no /uploads/ prefix) → prepended with VITE_R2_PUBLIC_BASE_URL
 *  - Relative /uploads/ paths → resolved against API base
 */
export function resolveLogoUrl(logoPath) {
    if (!logoPath) return '';
    if (/^(blob:|data:)/i.test(logoPath)) return logoPath;

    const baseURL = apiClient.defaults.baseURL || window.location.origin;
    const r2PublicBase =
        import.meta.env.VITE_R2_PUBLIC_BASE_URL
        || import.meta.env.VITE_R2_PUBLIC_URL
        || import.meta.env.VITE_LOGO_CDN_BASE_URL
        || '';

    const normalizedR2Base = r2PublicBase ? r2PublicBase.replace(/\/+$/, '') : '';
    const normalizedPathInput = String(logoPath).trim();

    if (/^https?:\/\//i.test(normalizedPathInput)) {
        try {
            const incoming = new URL(normalizedPathInput);
            const incomingHost = incoming.hostname.toLowerCase();
            const isLocalHost = incomingHost === 'localhost' || incomingHost === '127.0.0.1' || incomingHost === '::1';
            if (!isLocalHost) return normalizedPathInput;
            const apiBase = new URL(baseURL);
            return new URL(`${incoming.pathname}${incoming.search}${incoming.hash}`, apiBase).toString();
        } catch {
            return normalizedPathInput;
        }
    }

    if (normalizedR2Base && !normalizedPathInput.startsWith('/uploads/') && !normalizedPathInput.startsWith('uploads/')) {
        const cleanedPath = normalizedPathInput.replace(/^\/+/, '');
        return `${normalizedR2Base}/${cleanedPath}`;
    }

    const normalizedPath = normalizedPathInput.startsWith('/uploads/')
        ? normalizedPathInput
        : normalizedPathInput.startsWith('uploads/')
            ? `/${normalizedPathInput}`
            : `/uploads/${normalizedPathInput.split('/').pop()}`;

    return new URL(normalizedPath, baseURL).toString();
}
