import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();

        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const payload: any = exception.getResponse();
            const message = typeof payload === 'object' ? payload.message : String(payload);
            const code = typeof payload === 'object' && payload.code ? payload.code : 'HTTP_ERROR';

            return response.status(status).json({
                success: false,
                error: {
                    message,
                    code,
                },
            });
        }

        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR',
            },
        });
    }
}
