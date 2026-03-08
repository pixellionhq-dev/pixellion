import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    async register(email: string, username: string, password: string) {
        const existing = await this.prisma.user.findFirst({
            where: { OR: [{ email }, { username }] },
        });
        if (existing) {
            throw new ConflictException('Email or username already exists');
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const { user, buyer } = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: { email, username, passwordHash },
            });

            // Auto-create a buyer profile
            const buyer = await tx.buyer.create({
                data: {
                    userId: user.id,
                    country: 'US',
                    flag: '🇺🇸',
                    color: this.generateColor(),
                },
            });

            return { user, buyer };
        });

        const token = this.jwtService.sign({ sub: user.id, email: user.email });

        return {
            token,
            user: { id: user.id, email: user.email, username: user.username },
            buyer: { id: buyer.id, color: buyer.color },
        };
    }

    async login(email: string, password: string) {
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: { buyer: true },
        });
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const token = this.jwtService.sign({ sub: user.id, email: user.email });

        return {
            token,
            user: { id: user.id, email: user.email, username: user.username },
            buyer: user.buyer
                ? { id: user.buyer.id, color: user.buyer.color }
                : null,
        };
    }

    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { buyer: { include: { _count: { select: { pixels: true } } } } },
        });
        if (!user) throw new UnauthorizedException();

        return {
            id: user.id,
            email: user.email,
            username: user.username,
            buyer: user.buyer
                ? {
                    id: user.buyer.id,
                    color: user.buyer.color,
                    country: user.buyer.country,
                    flag: user.buyer.flag,
                    pixelCount: user.buyer._count.pixels,
                }
                : null,
        };
    }

    private generateColor(): string {
        const colors = [
            '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
            '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#0ea5e9',
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}
