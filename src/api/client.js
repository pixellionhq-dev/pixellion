import axios from 'axios';

// FIX 4 — Log R2 env config at startup so we can audit logo URL resolution
console.log('[env] VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('[env] VITE_R2_PUBLIC_BASE_URL:', import.meta.env.VITE_R2_PUBLIC_BASE_URL);
console.log('[env] VITE_R2_PUBLIC_URL:', import.meta.env.VITE_R2_PUBLIC_URL);
console.log('[env] VITE_LOGO_CDN_BASE_URL:', import.meta.env.VITE_LOGO_CDN_BASE_URL);

export const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'https://seashell-app-f4kca.ondigitalocean.app',
    withCredentials: false,
    timeout: 30_000,
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
apiClient.interceptors.response.use((response) => response);
