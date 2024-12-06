import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

interface SignInDto {
  email: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signin')
  async signIn(@Body() body: SignInDto) {
    return this.authService.signIn(body.email, body.password);
  }
}
