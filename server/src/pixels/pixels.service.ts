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
    return this.prisma.pixelBlock.findMany({
      where: {
        xStart: { lte: viewport.maxX },
        yStart: { lte: viewport.maxY },
      },
      take: 1000,
    });
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
    }

    const buyer = await this.prisma.buyer.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const purchase = await this.prisma.purchase.create({
      data: {
        buyerId: buyer.id,
        brandName,
        url: brandUrl,
        logoUrl,
        pixelCount: pixels.length,
        totalPrice: pixels.length * PIXEL_PRICE,
      },
    });

    return purchase;
  }
}