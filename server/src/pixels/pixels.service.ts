import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { writeFile } from 'fs/promises';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

const PIXEL_PRICE = parseFloat(process.env.PIXEL_PRICE || '100');

@Injectable()
export class PixelsService {
    constructor(private prisma: PrismaService) { }

    async getAllOwned() {
        const pixels = await this.prisma.pixel.findMany({
            include: {
                owner: { select: { id: true, country: true, flag: true, color: true } },
                purchase: { select: { id: true, brandName: true, url: true, logoUrl: true, fitMode: true, imageWidth: true, imageHeight: true } }
            },
        });
        return pixels.map((p) => ({
            id: p.id,
            x: p.x,
            y: p.y,
            color: p.color,
            ownerId: p.ownerId,
            purchaseId: p.purchaseId,
            ownerName: p.purchase?.brandName || 'Anonymous',
            ownerUrl: p.purchase?.url,
            ownerLogo: p.purchase?.logoUrl,
            fitMode: p.purchase?.fitMode,
            imageWidth: p.purchase?.imageWidth,
            imageHeight: p.purchase?.imageHeight,
            country: p.owner.country,
            flag: p.owner.flag,
        }));
    }

    /**
     * Sanitize and normalize a brand URL.
     * - Blocks javascript:, data:, and vbscript: schemes.
     * - Enforces https:// (upgrades http:// to https://).
     */
    private sanitizeUrl(raw: string): string {
        const trimmed = raw.trim();
        // Block dangerous schemes
        if (/^(javascript|data|vbscript):/i.test(trimmed)) {
            throw new BadRequestException('URL contains a disallowed scheme');
        }
        // Upgrade http to https
        return trimmed.replace(/^http:\/\//i, 'https://');
    }

    async purchase(userId: string, pixels: { x: number; y: number }[], color?: string, brandName?: string, brandUrl?: string, file?: Express.Multer.File, fitMode?: string, imageWidth?: number, imageHeight?: number) {
        if (!pixels.length) throw new BadRequestException('No pixels selected');
        if (pixels.length > 2500) throw new BadRequestException('Maximum 2500 pixels per purchase');

        if (!brandName || brandName.trim() === '') {
            throw new BadRequestException('Brand name is required');
        }

        if (!brandUrl || !/^https?:\/\/.+/.test(brandUrl)) {
            throw new BadRequestException('A valid brand website URL starting with http:// or https:// is required');
        }

        const safeBrandUrl = this.sanitizeUrl(brandUrl);

        let finalLogoUrl: string | undefined = undefined;
        if (file) {
            const ext = extname(file.originalname);
            const filename = `${uuidv4()}${ext}`;
            await writeFile(`./uploads/${filename}`, file.buffer);
            finalLogoUrl = `http://localhost:3001/uploads/${filename}`;
        }

        // Find buyer for this user
        const buyer = await this.prisma.buyer.findUnique({ where: { userId } });
        if (!buyer) throw new BadRequestException('No buyer profile found');

        const coords = pixels.map((p) => ({ x: Math.floor(p.x), y: Math.floor(p.y) }));
        const totalPrice = pixels.length * PIXEL_PRICE;
        const pixelColor = color || buyer.color;

        // Transaction with unique-constraint safety net for concurrent purchases
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                // Ensure the check for existing pixels specifically compares the incoming (x, y) coordinates
                const existing = await tx.pixel.findMany({
                    where: { OR: coords.map((c) => ({ x: c.x, y: c.y })) },
                });

                if (existing.length > 0) {
                    throw new BadRequestException(`${existing.length} pixel(s) already owned`);
                }

                if (color) {
                    await tx.buyer.update({
                        where: { id: buyer.id },
                        data: { color },
                    });
                }

                const purchase = await tx.purchase.create({
                    data: {
                        buyerId: buyer.id,
                        brandName,
                        url: safeBrandUrl,
                        ...(finalLogoUrl ? { logoUrl: finalLogoUrl } : {}),
                        fitMode: fitMode || 'cover',
                        ...(imageWidth ? { imageWidth } : {}),
                        ...(imageHeight ? { imageHeight } : {}),
                        pixelCount: pixels.length,
                        totalPrice,
                    },
                });

                await tx.pixel.createMany({
                    data: coords.map((c) => ({ x: c.x, y: c.y, ownerId: buyer.id, purchaseId: purchase.id, color: pixelColor })),
                });

                return { purchase };
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });

            return {
                purchaseId: result.purchase.id,
                pixelCount: pixels.length,
                totalPrice,
                pixels: coords.map((p) => ({ ...p, color: pixelColor })),
            };
        } catch (err: any) {
            // Prisma P2002 = unique constraint violation (concurrent purchase race)
            if (err?.code === 'P2002') {
                throw new BadRequestException('Some of the selected pixels were just purchased by another user. Please refresh and try again.');
            }
            throw err;
        }
    }
}
