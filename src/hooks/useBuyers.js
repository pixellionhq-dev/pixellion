import { useQuery } from '@tanstack/react-query';
import { getLeaderboard, getDirectory, getStats } from '../api/buyers';

export const useLeaderboard = () => {
    return useQuery({
        queryKey: ['leaderboard'],
        queryFn: getLeaderboard,
        initialData: [],
        staleTime: 60_000,
    });
};

export const useDirectory = (search, country) => {
    return useQuery({
        queryKey: ['buyers', search, country],
        queryFn: () => getDirectory(search, country),
        initialData: [],
        staleTime: 60_000,
    });
};

export const useStats = () => {
    return useQuery({
        queryKey: ['stats'],
        queryFn: getStats,
        initialData: null,
        staleTime: 60_000,
    });
};
