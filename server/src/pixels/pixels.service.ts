import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const PIXEL_PRICE = parseFloat(process.env.PIXEL_PRICE || '100');

// Cloudflare R2 configuration (S3-compatible)
function createR2Client(): S3Client | null {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
        return null;
    }

    return new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
    });
}

const r2Client = createR2Client();
const R2_BUCKET = process.env.R2_BUCKET_NAME || '';
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

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

            if (!r2Client || !R2_BUCKET || !R2_PUBLIC_URL) {
                throw new InternalServerErrorException('R2 storage is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL on Render.');
            }

            const contentType = file.mimetype || 'application/octet-stream';
            try {
                await r2Client.send(new PutObjectCommand({
                    Bucket: R2_BUCKET,
                    Key: `logos/${filename}`,
                    Body: file.buffer,
                    ContentType: contentType,
                    CacheControl: 'public, max-age=31536000, immutable',
                }));
            } catch (error) {
                console.error("R2 Upload Failed:", error);
                throw new InternalServerErrorException("Failed to upload logo to R2 storage.");
            }
            finalLogoUrl = `${R2_PUBLIC_URL}/logos/${filename}`;
            console.log('R2 upload result:', finalLogoUrl);
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

                console.log('Saving to DB with logoUrl:', finalLogoUrl);

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
