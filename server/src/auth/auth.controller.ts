import { Body, Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Public()
    @Post('register')
    async register(@Body() body: { email: string; username: string; password: string }) {
        console.log('REGISTER PAYLOAD:', body);
        return this.authService.register(body.email, body.username, body.password);
    }

    @Public()
    @Post('signup')
    async signup(@Body() body: { email: string; password: string }) {
        console.log('SIGNUP PAYLOAD:', { email: body.email });
        return this.authService.signup(body.email, body.password);
    }

    @Public()
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

    @Public()
    @Post('supabase')
    async supabase(@Body("access_token") access_token: string) {
        return this.authService.supabaseLogin(access_token);
    }
}
