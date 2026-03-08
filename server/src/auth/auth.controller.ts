import { Body, Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')
    async register(@Body() body: { email: string; username: string; password: string }) {
        console.log('REGISTER PAYLOAD:', body);
        return this.authService.register(body.email, body.username, body.password);
    }

    @Post('login')
    async login(@Body() body: { email: string; password: string }) {
        console.log('LOGIN PAYLOAD:', body);
        return this.authService.login(body.email, body.password);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async me(@Request() req) {
        return this.authService.getProfile(req.user.sub);
    }
}
