import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { getJwtConfig } from './auth.config';

@Module({
    imports: [
        PassportModule,
        JwtModule.registerAsync({
            useFactory: async () => {
                const jwt = getJwtConfig();
                return {
                    secret: jwt.secret,
                    signOptions: { expiresIn: jwt.expiresIn as any },
                };
            },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy],
    exports: [AuthService],
})
export class AuthModule { }
