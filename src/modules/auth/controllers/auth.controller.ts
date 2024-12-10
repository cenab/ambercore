import { Controller, Post, Body, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../services/auth.service';

export class AuthDto {
  email: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() { email, password }: AuthDto) {
    return this.authService.signInWithEmail(email, password);
  }

  @Get('session')
  async getSession(@Headers('authorization') auth: string) {
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid token format');
    }
    const token = auth.split(' ')[1];
    return this.authService.verifySession(token);
  }

  @Post('refresh')
  async refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refreshSession(refreshToken);
  }

  @Post('signout')
  async signOut(@Headers('authorization') auth: string) {
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid token format');
    }
    const token = auth.split(' ')[1];
    return this.authService.signOut(token);
  }
} 