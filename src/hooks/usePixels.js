import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPixels, purchasePixels } from '../api/pixels';

export const usePixels = () => {
    const queryClient = useQueryClient();
    const abortRef = useRef(null);
    const fetchCountRef = useRef(0);

    const { data: pixels, isLoading, refetch } = useQuery({
        queryKey: ['pixels'],
        queryFn: async () => [],
        initialData: [],
        staleTime: 60_000,
        cacheTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        enabled: false,
    });

    const fetchViewportPixels = useCallback(async (viewport) => {
        await queryClient.cancelQueries({ queryKey: ['pixels'] });

        if (abortRef.current) {
            abortRef.current.abort();
        }

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            console.log('PIXEL FETCH TRIGGERED');
            const data = await getPixels(viewport, { signal: controller.signal });
            if (abortRef.current !== controller) return [];

            const safeData = Array.isArray(data) ? data : [];
            queryClient.setQueryData(['pixels'], safeData);

            fetchCountRef.current += 1;
            console.log('VIEWPORT_FETCH_COUNT', fetchCountRef.current);
            console.log('PIXELS_RETURNED', safeData.length);

            return safeData;
        } catch (err) {
            if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
                return [];
            }
            throw err;
        }
    }, [queryClient]);

    useEffect(() => {
        return () => {
            if (abortRef.current) {
                abortRef.current.abort();
            }
        };
    }, []);

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
        fetchViewportPixels,
        purchase: purchaseMutation.mutateAsync,
        isPurchasing: purchaseMutation.isPending,
    };
};
