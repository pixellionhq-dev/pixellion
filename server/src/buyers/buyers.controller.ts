import { Controller, Get, Header, Query } from '@nestjs/common';
import { BuyersService } from './buyers.service';
import { Public } from '../auth/public.decorator';

const STATS_CACHE_TTL_MS = 30_000;
let statsCache: any = null;
let statsCacheUpdatedAt = 0;
let statsRefreshInFlight = false;

@Controller()
export class BuyersController {
    constructor(private buyersService: BuyersService) { }

    @Public()
    @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
    @Get('leaderboard')
    async leaderboard() {
        return this.buyersService.getLeaderboard();
    }

    @Public()
    @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
    @Get('buyers')
    async directory(@Query('search') search?: string, @Query('country') country?: string) {
        return this.buyersService.getDirectory(search, country);
    }

    @Public()
    @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
    @Get('stats')
    async stats() {
        const now = Date.now();
        const isCacheFresh = statsCache && (now - statsCacheUpdatedAt < STATS_CACHE_TTL_MS);

        if (isCacheFresh) {
            if (!statsRefreshInFlight) {
                statsRefreshInFlight = true;
                this.buyersService.getStats()
                    .then((freshStats) => {
                        statsCache = freshStats;
                        statsCacheUpdatedAt = Date.now();
                    })
                    .catch(() => {
                        // Keep serving stale cache on refresh errors.
                    })
                    .finally(() => {
                        statsRefreshInFlight = false;
                    });
            }

            return statsCache;
        }

        const freshStats = await this.buyersService.getStats();
        statsCache = freshStats;
        statsCacheUpdatedAt = Date.now();
        return freshStats;
    }
}
