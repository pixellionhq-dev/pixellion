import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const PIXEL_PRICE = parseFloat(process.env.PIXEL_PRICE || '100');

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

type Viewport = { minX: number; minY: number; maxX: number; maxY: number };

@Injectable()
export class PixelsService {
  constructor(private prisma: PrismaService) {}

  async getViewportBlocks(viewport: Viewport) {
    const pixelBlocks = await this.prisma.pixelBlock.findMany({
      where: {
        xStart: { lte: viewport.maxX },
        yStart: { lte: viewport.maxY },
      },
      take: 1000,
    });

    if (!pixelBlocks.length) return { blocks: [], brands: [] };

    // brandId stores the purchase.id — fetch purchase metadata for the canvas
    const purchaseIds = [...new Set(pixelBlocks.map((b) => b.brandId))];
    const purchases = await this.prisma.purchase.findMany({
      where: { id: { in: purchaseIds } },
      select: {
        id: true,
        brandName: true,
        logoUrl: true,
        url: true,
        pixelCount: true,
        fitMode: true,
        imageWidth: true,
        imageHeight: true,
      },
    });

    const brands = purchases.map((p) => ({
      brandId: p.id,
      brandName: p.brandName,
      logoUrl: p.logoUrl,
      url: p.url,
      totalPixels: p.pixelCount,
      fitMode: p.fitMode,
      imageWidth: p.imageWidth,
      imageHeight: p.imageHeight,
    }));

    return { blocks: pixelBlocks, brands };
  }

  async purchase(
    userId: string,
    pixels: { x: number; y: number }[],
    color?: string,
    brandName?: string,
    brandUrl?: string,
    file?: Express.Multer.File,
    fitMode?: string,
    imageWidth?: number,
    imageHeight?: number
  ) {
    if (!pixels.length) throw new BadRequestException('No pixels');

    let logoUrl: string | undefined;

    if (file && r2Client) {
      const filename = `${uuidv4()}${extname(file.originalname)}`;

      await r2Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: `logos/${filename}`,
          Body: file.buffer,
        })
      );

      logoUrl = `${R2_PUBLIC_URL}/logos/${filename}`;
      console.log('[purchase] logoUrl to save:', logoUrl);
      if (!R2_PUBLIC_URL) {
        console.warn('[purchase] WARNING: R2_PUBLIC_URL is not set — logoUrl will be a relative path, logo will not display');
      }
    }

    const buyer = await this.prisma.buyer.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const purchase = await this.prisma.$transaction(async (tx) => {
      // Conflict check — reject if any of these pixels are already taken
      const taken = await tx.pixel.findMany({
        where: { OR: pixels.map((p) => ({ x: p.x, y: p.y })) },
        select: { x: true, y: true },
      });
      if (taken.length) {
        throw new BadRequestException(
          `Pixels already taken: ${taken.map((p) => `${p.x},${p.y}`).join(' ')}`
        );
      }

      const purchase = await tx.purchase.create({
        data: {
          buyerId: buyer.id,
          brandName: brandName ?? '',
          url: brandUrl,
          logoUrl,
          fitMode: fitMode ?? 'cover',
          imageWidth,
          imageHeight,
          pixelCount: pixels.length,
          totalPrice: pixels.length * PIXEL_PRICE,
        },
      });

      await tx.pixel.createMany({
        data: pixels.map((p) => ({
          x: p.x,
          y: p.y,
          ownerId: buyer.id,
          purchaseId: purchase.id,
          color: color ?? '#0a0a0a',
        })),
      });

      const xs = pixels.map((p) => p.x);
      const ys = pixels.map((p) => p.y);
      const xStart = Math.min(...xs);
      const yStart = Math.min(...ys);

      await tx.pixelBlock.create({
        data: {
          brandId: purchase.id,
          ownerId: buyer.id,
          xStart,
          yStart,
          width: Math.max(...xs) - xStart + 1,
          height: Math.max(...ys) - yStart + 1,
        },
      });

      return purchase;
    });

    return purchase;
  }
}