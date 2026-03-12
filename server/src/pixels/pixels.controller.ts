import { Body, Controller, Get, Post, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PixelsService } from './pixels.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('pixels')
export class PixelsController {
    constructor(private pixelsService: PixelsService) { }

    @Get()
    async getAll() {
        return this.pixelsService.getAllOwned();
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
