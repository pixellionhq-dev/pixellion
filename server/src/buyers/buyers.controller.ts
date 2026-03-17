import { Controller, Get, Query } from '@nestjs/common';
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
    @Get('leaderboard')
    async leaderboard() {
        return this.buyersService.getLeaderboard();
    }

    @Public()
    @Get('buyers')
    async directory(@Query('search') search?: string, @Query('country') country?: string) {
        return this.buyersService.getDirectory(search, country);
    }

    @Public()
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
