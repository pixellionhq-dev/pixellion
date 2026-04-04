import { Injectable, UnauthorizedException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { createClient } from '@supabase/supabase-js';

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
            access_token: token,
            user: { id: user.id, email: user.email, username: user.username },
            buyer: { id: buyer.id, color: buyer.color },
        };
    }

    async signup(email: string, password: string) {
        const existing = await this.prisma.user.findFirst({
            where: { email },
        });
        if (existing) {
            throw new ConflictException('Email already exists');
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const username = `${email.split('@')[0]}_${Math.random().toString(36).slice(2, 8)}`;

        const { user, buyer } = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: { email, username, passwordHash },
            });

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
            access_token: token,
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
            access_token: token,
            user: { id: user.id, email: user.email, username: user.username },
            buyer: user.buyer
                ? { id: user.buyer.id, color: user.buyer.color }
                : null,
        };
    }

    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { buyer: { include: { _count: { select: { blocks: true } } } } },
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
                    pixelCount: user.buyer._count.blocks,
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
    async supabaseLogin(access_token: string) {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        console.log("ENV CHECK:");
        console.log("SUPABASE_URL:", supabaseUrl);
        console.log("SERVICE_ROLE_KEY exists:", !!supabaseKey);
        console.log("ACCESS TOKEN:", access_token?.slice(0, 30));

        if (!supabaseUrl || !supabaseKey) {
            throw new HttpException({ message: 'Supabase admin credentials missing', code: 'SUPABASE_ADMIN_MISSING' }, HttpStatus.INTERNAL_SERVER_ERROR);
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabaseAdmin.auth.getUser(access_token);

        console.log("SUPABASE RESPONSE:", data, error);

        if (error || !data?.user) {
            throw new UnauthorizedException(error?.message || 'Invalid Supabase access token');
        }

        const email = typeof data.user.email === 'string' ? data.user.email : '';
        if (!email) {
            throw new UnauthorizedException('No email found in Supabase user');
        }

        const providerId = data.user.id;

        let user = await this.prisma.user.findUnique({ where: { email }, include: { buyer: true } });
        if (!user) {
            const providerSuffix = providerId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toLowerCase();
            const username = `${email.split('@')[0]}${providerSuffix ? `_${providerSuffix}` : ''}`;
            const { user: newUser, buyer } = await this.prisma.$transaction(async (tx) => {
                const newUser = await tx.user.create({ data: { email, username, passwordHash: '' } });
                const buyer = await tx.buyer.create({
                    data: {
                        userId: newUser.id,
                        country: 'US',
                        flag: '🇺🇸',
                        color: this.generateColor(),
                    },
                });
                return { user: newUser, buyer };
            });
            user = { ...newUser, buyer };
        }
        
        const token = this.jwtService.sign({ sub: user.id, email: user.email });
        return {
            access_token: token,
            user: { id: user.id, email: user.email, username: user.username },
            buyer: user.buyer ? { id: user.buyer.id, color: user.buyer.color } : null,
        };
    }
}
