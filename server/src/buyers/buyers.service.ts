import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BuyersService {
    constructor(private prisma: PrismaService) { }

    async getLeaderboard() {
        const buyers = await this.prisma.buyer.findMany({
            include: { user: true, _count: { select: { pixels: true } } },
            orderBy: { pixels: { _count: 'desc' } },
            take: 10,
        });

        return buyers
            .filter((b) => b._count.pixels > 0)
            .map((b, i) => ({
                rank: i + 1,
                id: b.id,
                brand: b.user?.username || 'Anonymous',
                pixels: b._count.pixels,
                country: b.country,
                flag: b.flag,
                color: b.color,
            }));
    }

    async getDirectory(search?: string, country?: string) {
        const where: any = {};

        if (search) {
            where.user = { username: { contains: search, mode: 'insensitive' } };
        }
        if (country && country !== 'All') {
            where.country = country;
        }

        const buyers = await this.prisma.buyer.findMany({
            where,
            include: { user: true, _count: { select: { pixels: true } } },
        });

        return buyers
            .filter((b) => b._count.pixels > 0)
            .sort((a, b) => (a.user?.username || '').localeCompare(b.user?.username || ''))
            .map((b) => ({
                id: b.id,
                brand: b.user?.username || 'Anonymous',
                pixels: b._count.pixels,
                country: b.country,
                flag: b.flag,
                color: b.color,
                joined: b.createdAt.toISOString().slice(0, 7),
            }));
    }

    async getStats() {
        const [totalPixelsSold, totalBuyers, topBuyer, newestBuyer, mostExpensive] = await Promise.all([
            this.prisma.pixel.count(),
            this.prisma.buyer.count({ where: { pixels: { some: {} } } }),
            this.prisma.buyer.findFirst({
                include: { user: true, _count: { select: { pixels: true } } },
                orderBy: { pixels: { _count: 'desc' } },
            }),
            this.prisma.buyer.findFirst({
                where: { pixels: { some: {} } },
                include: { user: true },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.purchase.findFirst({
                orderBy: { totalPrice: 'desc' },
                include: { buyer: { include: { user: true } } },
            }),
        ]);

        return {
            totalPixelsSold,
            totalBuyers,
            currentPixelPrice: parseFloat(process.env.PIXEL_PRICE || '100') || 100,
            mostExpensivePixel: mostExpensive
                ? { price: mostExpensive.totalPrice, owner: mostExpensive.buyer.user?.username || 'Anonymous' }
                : { price: 0, owner: 'N/A' },
            newestBuyer: newestBuyer
                ? { brand: newestBuyer.user?.username || 'Anonymous' }
                : { brand: 'N/A' },
            mostPixelsOwned: topBuyer
                ? { brand: topBuyer.user?.username || 'Anonymous', count: topBuyer._count.pixels }
                : { brand: 'N/A', count: 0 },
        };
    }
}
