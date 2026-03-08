import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.enableCors({
        origin: (origin, callback) => {
            if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    });

    // BUG 1 FIX (REVISED): NestJS CORS config doesn't natively apply to bare express.static mount points.
    app.use('/uploads', (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const origin = req.headers.origin;
        if (origin && /^http:\/\/localhost:\d+$/.test(origin)) {
            res.header('Access-Control-Allow-Origin', origin);
        } else {
            res.header('Access-Control-Allow-Origin', '*'); // Fallback for direct loading
        }
        res.header('Cross-Origin-Resource-Policy', 'cross-origin');
        next();
    }, express.static(join(__dirname, '..', 'uploads')));

    const port = process.env.PORT || 3001;
    await app.listen(port, '0.0.0.0');
    console.log(`🚀 Pixellion API running on http://localhost:${port}`);
}
bootstrap();
