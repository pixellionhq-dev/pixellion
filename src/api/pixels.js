import { apiClient } from './client';

export const getPixels = async (params, options = {}) => {
    const minX = params?.minX ?? 0;
    const minY = params?.minY ?? 0;
    const maxX = params?.maxX ?? 100;
    const maxY = params?.maxY ?? 100;

    const { data } = await apiClient.get(`/pixels?minX=${minX}&minY=${minY}&maxX=${maxX}&maxY=${maxY}`, {
        signal: options.signal,
    });
    return data?.data ?? data;
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
    return data?.data ?? data;
};
