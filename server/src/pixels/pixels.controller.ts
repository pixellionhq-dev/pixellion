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
    if ([minX, minY, maxX, maxY].some(v => v === undefined || v === null || v === '')) {
      throw new BadRequestException('Viewport params required');
    }

    const parsedMinX = parseInt(minX!, 10);
    const parsedMinY = parseInt(minY!, 10);
    const parsedMaxX = parseInt(maxX!, 10);
    const parsedMaxY = parseInt(maxY!, 10);

    if ([parsedMinX, parsedMinY, parsedMaxX, parsedMaxY].some(v => Number.isNaN(v))) {
      throw new BadRequestException('Invalid viewport values');
    }

    return this.pixelsService.getViewportBlocks({
      minX: parsedMinX,
      minY: parsedMinY,
      maxX: parsedMaxX,
      maxY: parsedMaxY,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('purchase')
  @UseInterceptors(FileInterceptor('file'))
  async purchase(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    let pixels;
    try {
      pixels =
        typeof body.pixels === 'string'
          ? JSON.parse(body.pixels)
          : body.pixels;
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