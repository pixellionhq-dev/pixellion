import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMe, login, register, logout } from '../api/auth';

export const useAuth = () => {
    const queryClient = useQueryClient();

    const { data: user, isLoading } = useQuery({
        queryKey: ['auth'],
        queryFn: getMe,
        retry: false,
    });

    const loginMutation = useMutation({
        mutationFn: ({ email, password }) => login(email, password),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth'] }),
    });

    const registerMutation = useMutation({
        mutationFn: ({ email, username, password }) => register(email, username, password),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth'] }),
    });

    return {
        user,
        isLoading,
        login: loginMutation.mutateAsync,
        register: registerMutation.mutateAsync,
        logout,
    };
};
