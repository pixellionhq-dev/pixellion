import { useQuery } from '@tanstack/react-query';
import { getLeaderboard, getDirectory, getStats } from '../api/buyers';

export const useLeaderboard = () => {
    return useQuery({
        queryKey: ['leaderboard'],
        queryFn: getLeaderboard,
        initialData: [],
    });
};

export const useDirectory = (search, country) => {
    return useQuery({
        queryKey: ['buyers', search, country],
        queryFn: () => getDirectory(search, country),
        initialData: [],
    });
};

export const useStats = () => {
    return useQuery({
        queryKey: ['stats'],
        queryFn: getStats,
        initialData: null,
    });
};
