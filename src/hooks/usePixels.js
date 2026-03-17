import { useMutation, useQueryClient } from '@tanstack/react-query';
import { purchasePixels } from '../api/pixels';

export const usePixels = () => {
    const queryClient = useQueryClient();

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
        purchase: purchaseMutation.mutateAsync,
        isPurchasing: purchaseMutation.isPending,
    };
};
