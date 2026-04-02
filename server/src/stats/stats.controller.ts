import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';

@Controller('stats')
export class StatsController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  async getStats() {
    const totalUsers = await this.prisma.user.count();
    const purchaseAgg = await this.prisma.purchase.aggregate({
      _sum: { pixelCount: true, totalPrice: true },
    });

    return {
      totalPixels: purchaseAgg._sum.pixelCount || 0,
      totalUsers,
      totalRevenue: purchaseAgg._sum.totalPrice || 0,
    };
  }
}
