import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { PixelsService } from './pixels.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

@Controller('pixels')
export class PixelsController {
  constructor(private pixelsService: PixelsService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get()
  async getAll(
    @Query('minX') minX?: string,
    @Query('minY') minY?: string,
    @Query('maxX') maxX?: string,
    @Query('maxY') maxY?: string,
  ) {
    if ([minX, minY, maxX, maxY].some(v => !v)) {
      throw new BadRequestException('Viewport params required');
    }

    return this.pixelsService.getViewportBlocks({
      minX: parseInt(minX!, 10),
      minY: parseInt(minY!, 10),
      maxX: parseInt(maxX!, 10),
      maxY: parseInt(maxY!, 10),
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