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
    const response = await apiClient.post('/auth/login', { email, password });
    if (response.data?.access_token || response.data?.data?.access_token) {
        const token = response.data.access_token || response.data.data.access_token;
        console.log("TOKEN:", token);
        localStorage.setItem("token", token);
        window.dispatchEvent(new Event('auth:changed'));
    } else if (response.data?.token || response.data?.data?.token) {
        const token = response.data.token || response.data.data.token;
        console.log("TOKEN:", token);
        localStorage.setItem("token", token);
        window.dispatchEvent(new Event('auth:changed'));
    }
    return response.data;
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
