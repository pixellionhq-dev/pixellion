import { apiClient } from './client';

export const getPixels = async (params) => {
    const { data } = await apiClient.get('/pixels', { params });
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
