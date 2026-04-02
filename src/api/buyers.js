import { apiClient } from './client';

export const getLeaderboard = async () => {
    const { data } = await apiClient.get('/leaderboard');
    return data?.data ?? data;
};

export const getDirectory = async (search, country) => {
    const { data } = await apiClient.get('/buyers', { params: { search, country } });
    return data?.data ?? data;
};

export const getStats = async () => {
    const { data } = await apiClient.get('/stats');
    console.log("STATS RESPONSE:", data);
    return data?.data ?? data;
};
