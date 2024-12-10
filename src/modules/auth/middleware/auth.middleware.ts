import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { User } from '@supabase/supabase-js';

export interface RequestWithUser extends Request {
  user: User;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private authService: AuthService) {}

  async use(req: RequestWithUser, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    try {
      const token = authHeader.split(' ')[1];
      const user = await this.authService.verifySession(token);
      req.user = user;
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
} 