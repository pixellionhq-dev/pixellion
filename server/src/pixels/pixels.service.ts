import { Injectable, BadRequestException, InternalServerErrorException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
const VIEWPORT_CACHE_TTL_MS = 10_000;

type Viewport = { minX: number; minY: number; maxX: number; maxY: number };
type BrandSummary = {
    brandId: string;
    ownerId: string;
    brandName: string;
    logoUrl: string | null;
    totalPixels: number;
    rank: number;
};

@Injectable()
export class PixelsService {
    private viewportCache = new Map<string, { expiresAt: number; payload: { blocks: any[]; brands: BrandSummary[] } }>();

    constructor(private prisma: PrismaService) { }

    async getViewportBlocks(viewport: Viewport) {
        const cacheKey = `${viewport.minX}:${viewport.minY}:${viewport.maxX}:${viewport.maxY}`;
        const now = Date.now();
        const cached = this.viewportCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return cached.payload;
        }

        const candidateBlocks = await this.prisma.pixelBlock.findMany({
            where: {
                xStart: { lte: viewport.maxX },
                yStart: { lte: viewport.maxY },
            },
            orderBy: { createdAt: 'desc' },
            take: 5000,
        });

        const blocks = candidateBlocks.filter((block) => {
            const endX = block.xStart + block.width - 1;
            const endY = block.yStart + block.height - 1;
            return endX >= viewport.minX && endY >= viewport.minY;
        });

        const ownerIds = Array.from(new Set(blocks.map((b) => b.ownerId)));
        const buyers = ownerIds.length
            ? await this.prisma.buyer.findMany({ where: { id: { in: ownerIds } }, include: { user: true } })
            : [];
        const buyerMap = new Map(buyers.map((b) => [b.id, b]));

        const blockIdsByBrand = new Map<string, BrandSummary>();
        blocks.forEach((block) => {
            const key = block.brandId;
            const buyer = buyerMap.get(block.ownerId);
            const totalPixels = block.width * block.height;
            const existing = blockIdsByBrand.get(key);

            if (!existing) {
                blockIdsByBrand.set(key, {
                    brandId: key,
                    ownerId: block.ownerId,
                    brandName: buyer?.user?.username || key || 'Anonymous',
                    logoUrl: null,
                    totalPixels,
                    rank: 0,
                });
                return;
            }

            existing.totalPixels += totalPixels;
        });

        const brands = Array.from(blockIdsByBrand.values())
            .sort((a, b) => b.totalPixels - a.totalPixels)
            .map((brand, index) => ({ ...brand, rank: index + 1 }));

        const payload = { blocks, brands };
        this.viewportCache.set(cacheKey, { expiresAt: now + VIEWPORT_CACHE_TTL_MS, payload });
        return payload;
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

        // Ensure buyer exists and update color when provided
        const buyer = await this.prisma.buyer.upsert({
            where: { userId },
            update: color ? { color } : {},
            create: {
                userId,
                ...(color ? { color } : {}),
            },
        });

        const coords = pixels.map((p) => ({ x: Math.floor(p.x), y: Math.floor(p.y) }));
        const minX = Math.min(...coords.map((p) => p.x));
        const maxX = Math.max(...coords.map((p) => p.x));
        const minY = Math.min(...coords.map((p) => p.y));
        const maxY = Math.max(...coords.map((p) => p.y));
        const blockWidth = maxX - minX + 1;
        const blockHeight = maxY - minY + 1;
        const totalPrice = pixels.length * PIXEL_PRICE;
        const pixelColor = color || buyer.color;

        console.log('Saving to DB with logoUrl:', finalLogoUrl);

        const purchase = await this.prisma.purchase.create({
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

        try {
            await this.prisma.pixelBlock.create({
                data: {
                    brandId: brandName.trim(),
                    ownerId: buyer.id,
                    xStart: minX,
                    yStart: minY,
                    width: blockWidth,
                    height: blockHeight,
                },
            });
        } catch {
            throw new HttpException({ message: 'Failed to save pixel block', code: 'PIXEL_BLOCK_CREATE_FAILED' }, HttpStatus.INTERNAL_SERVER_ERROR);
        }

        this.viewportCache.clear();

        return {
            purchaseId: purchase.id,
            pixelCount: pixels.length,
            totalPrice,
            pixels: coords.map((p) => ({ ...p, color: pixelColor })),
        };
    }
}
