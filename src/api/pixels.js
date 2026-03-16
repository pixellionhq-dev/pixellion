import { apiClient } from './client';

export const getPixels = async (params, options = {}) => {
    const hasViewport =
        params
        && Number.isFinite(params.minX)
        && Number.isFinite(params.minY)
        && Number.isFinite(params.maxX)
        && Number.isFinite(params.maxY);

    if (!hasViewport) {
        throw new Error('Viewport params required for /pixels request');
    }

    const { data } = await apiClient.get('/pixels', {
        params,
        signal: options.signal,
    });
    return data;
};

export const purchasePixels = async (pixels, color, brandName, brandUrl, file, onUploadProgress, fitMode, imageWidth, imageHeight) => {
    const formData = new FormData();
    formData.append('pixels', JSON.stringify(pixels));
    if (color) formData.append('color', color);
    formData.append('brandName', brandName);
    formData.append('brandUrl', brandUrl);
    if (file) formData.append('file', file);
    if (fitMode) formData.append('fitMode', fitMode);
    if (imageWidth) formData.append('imageWidth', imageWidth);
    if (imageHeight) formData.append('imageHeight', imageHeight);

    const { data } = await apiClient.post('/pixels/purchase', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress,
        timeout: 30_000,
    });
    return data;
};
