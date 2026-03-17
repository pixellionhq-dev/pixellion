import { apiClient } from './client';

const notifyAuthChanged = () => {
    window.dispatchEvent(new Event('auth:changed'));
};

const setAuthToken = (token) => {
    if (!token) return;
    localStorage.setItem('token', token);
    notifyAuthChanged();
};

export const register = async (email, username, password) => {
    const { data } = await apiClient.post('/auth/register', { email, username, password });
    const payload = data?.data ?? data;
    if (payload?.token) {
        setAuthToken(payload.token);
    }
    return payload;
};

export const login = async (email, password) => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    const payload = data?.data ?? data;
    if (payload?.token) {
        setAuthToken(payload.token);
    }
    return payload;
};

export const getMe = async () => {
    const token = localStorage.getItem('token');
    const { data } = await apiClient.get('/auth/me', {
        headers: {
            Authorization: token ? `Bearer ${token}` : undefined,
        },
    });
    return data?.data ?? data;
};

export const logout = () => {
    localStorage.removeItem('token');
    notifyAuthChanged();
};
