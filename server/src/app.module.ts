import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PixelsModule } from './pixels/pixels.module';
import { BuyersModule } from './buyers/buyers.module';
import { StatsModule } from './stats/stats.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { SuccessResponseInterceptor } from './common/success-response.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';

@Module({
    imports: [
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
        ServeStaticModule.forRoot({
            rootPath: join(process.cwd(), 'uploads'),
            serveRoot: '/uploads',
        }),
        PrismaModule,
        AuthModule,
        PixelsModule,
        BuyersModule,
        StatsModule,
    ],
    providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_INTERCEPTOR, useClass: SuccessResponseInterceptor },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
    ],
})
export class AppModule { }
