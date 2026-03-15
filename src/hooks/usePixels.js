import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPixels, purchasePixels } from '../api/pixels';

export const usePixels = () => {
    const queryClient = useQueryClient();

    const { data: pixels, isLoading, refetch } = useQuery({
        queryKey: ['pixels'],
        queryFn: getPixels,
        initialData: [],
        staleTime: 0,
        refetchOnWindowFocus: false,
    });

    const purchaseMutation = useMutation({
        mutationFn: ({ pixels, color, brandName, brandUrl, file, onUploadProgress, fitMode, imageWidth, imageHeight }) =>
            purchasePixels(pixels, color, brandName, brandUrl, file, onUploadProgress, fitMode, imageWidth, imageHeight),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pixels'] });
            queryClient.invalidateQueries({ queryKey: ['stats'] });
            queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
            queryClient.invalidateQueries({ queryKey: ['buyers'] });
            queryClient.invalidateQueries({ queryKey: ['auth'] });
        },
    });

    return {
        pixels,
        isLoading,
        refetch,
        purchase: purchaseMutation.mutateAsync,
        isPurchasing: purchaseMutation.isPending,
    };
};
