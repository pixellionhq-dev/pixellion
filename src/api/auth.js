import { apiClient } from './client';

export const register = async (email, username, password) => {
    const { data } = await apiClient.post('/auth/register', { email, username, password });
    if (data.token) {
        localStorage.setItem('token', data.token);
    }
    return data;
};

export const login = async (email, password) => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    if (data.token) {
        localStorage.setItem('token', data.token);
    }
    return data;
};

export const getMe = async () => {
    const { data } = await apiClient.get('/auth/me');
    return data;
};

export const logout = () => {
    localStorage.removeItem('token');
    window.location.reload();
};
