import { Controller, Get, Query } from '@nestjs/common';
import { BuyersService } from './buyers.service';

@Controller()
export class BuyersController {
    constructor(private buyersService: BuyersService) { }

    @Get('leaderboard')
    async leaderboard() {
        return this.buyersService.getLeaderboard();
    }

    @Get('buyers')
    async directory(@Query('search') search?: string, @Query('country') country?: string) {
        return this.buyersService.getDirectory(search, country);
    }

    @Get('stats')
    async stats() {
        return this.buyersService.getStats();
    }
}
