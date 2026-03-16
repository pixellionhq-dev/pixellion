import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMe, login, register, logout } from '../api/auth';

export const useAuth = () => {
    const queryClient = useQueryClient();

    const { data: user, isLoading, refetch } = useQuery({
        queryKey: ['auth'],
        queryFn: getMe,
        retry: false,
        enabled: !!localStorage.getItem('token'),
    });

    const reloadAuth = async () => {
        await queryClient.invalidateQueries({ queryKey: ['auth'] });
        await refetch();
    };

    useEffect(() => {
        const onAuthChanged = () => {
            void reloadAuth();
        };

        window.addEventListener('auth:changed', onAuthChanged);
        return () => {
            window.removeEventListener('auth:changed', onAuthChanged);
        };
    }, []);

    const loginMutation = useMutation({
        mutationFn: ({ email, password }) => login(email, password),
        onSuccess: () => reloadAuth(),
    });

    const registerMutation = useMutation({
        mutationFn: ({ email, username, password }) => register(email, username, password),
        onSuccess: () => reloadAuth(),
    });

    return {
        user,
        isLoading,
        reloadAuth,
        login: loginMutation.mutateAsync,
        register: registerMutation.mutateAsync,
        logout,
    };
};
