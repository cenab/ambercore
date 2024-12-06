import { Controller, Post, Body, Logger, HttpStatus, HttpException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignInDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

interface SignInResponse {
  token: string;
  user: {
    id: string;
    email: string;
  };
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('signin')
  async signIn(@Body() body: SignInDto): Promise<SignInResponse> {
    try {
      return await this.authService.signIn(body.email, body.password);
    } catch (error) {
      this.logger.error('Sign in failed:', error);
      throw new HttpException(
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
