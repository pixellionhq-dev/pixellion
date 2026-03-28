import { Body, Controller, Get, Post, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException, Query, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { PixelsService } from './pixels.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

const BOARD_WIDTH = 1000;
const BOARD_HEIGHT = 1000;

@Controller('pixels')
export class PixelsController {
    constructor(private pixelsService: PixelsService) { }

    @Public()
    @Throttle({ default: { limit: 60, ttl: 60_000 } })
    @Get()
    async getAll(
        @Query('minX') minX?: string,
        @Query('minY') minY?: string,
        @Query('maxX') maxX?: string,
        @Query('maxY') maxY?: string,
    ) {
        if ([minX, minY, maxX, maxY].some(v => v === undefined || v === null || v === '')) {
            throw new BadRequestException('Viewport params required');
        }

        const parse = (value?: string) => {
            if (value === undefined || value === null || value === '') return undefined;
            const parsed = parseInt(value, 10);
            return Number.isNaN(parsed) ? undefined : parsed;
        };

        const parsedMinX = parse(minX);
        const parsedMinY = parse(minY);
        const parsedMaxX = parse(maxX);
        const parsedMaxY = parse(maxY);

        if ([parsedMinX, parsedMinY, parsedMaxX, parsedMaxY].some(v => v === undefined)) {
            throw new BadRequestException('Viewport params required');
        }

        return this.pixelsService.getAllOwned({
            minX: parsedMinX,
            minY: parsedMinY,
            maxX: parsedMaxX,
            maxY: parsedMaxY,
        });
    }

    @UseGuards(JwtAuthGuard)
    @Post('purchase')
    @UseInterceptors(FileInterceptor('file', {
        limits: {
            fileSize: 512 * 1024,
            fieldSize: 10 * 1024 * 1024,
            fields: 20,
        },
        fileFilter: (req, file, cb) => {
            if (file.mimetype.match(/\/(jpg|jpeg|png|svg\+xml)$/)) cb(null, true);
            else cb(new BadRequestException('Unsupported file type'), false);
        }
    }))
    async purchase(
        @Request() req,
        @UploadedFile() file: Express.Multer.File,
        @Body() body: any,
    ) {
        let pixels;
        try {
            pixels = typeof body.pixels === 'string' ? JSON.parse(body.pixels) : body.pixels;
        } catch {
            throw new BadRequestException('Invalid pixels payload');
        }
        return this.pixelsService.purchase(
            req.user.sub,
            pixels,
            body.color,
            body.brandName,
            body.brandUrl,
            file,
            body.fitMode,
            body.imageWidth ? parseInt(body.imageWidth, 10) : undefined,
            body.imageHeight ? parseInt(body.imageHeight, 10) : undefined
        );
    }
}
