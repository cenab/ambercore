import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { RedisService } from '../../../core/shared/services/redis.service';

export interface AuthResponse {
  user: User | null;
  session: {
    access_token: string;
    refresh_token: string;
  } | null;
}

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;
  private readonly SESSION_TTL = 3600; // 1 hour in seconds

  constructor(
    private configService: ConfigService,
    private redisService: RedisService
  ) {
    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const supabaseKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_KEY');
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private getCacheKey(token: string): string {
    return `auth:${token}`;
  }

  private async getFromCache(token: string): Promise<User | null> {
    try {
      const cached = await this.redisService.get(this.getCacheKey(token));
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  private async setCache(token: string, user: User): Promise<void> {
    try {
      await this.redisService.set(
        this.getCacheKey(token),
        JSON.stringify(user),
        this.SESSION_TTL
      );
    } catch {
      // Fail silently - cache is optional
    }
  }

  private async clearCache(token: string): Promise<void> {
    try {
      await this.redisService.del(this.getCacheKey(token));
    } catch {
      // Fail silently - cache is optional
    }
  }

  async signInWithEmail(email: string, password: string): Promise<AuthResponse> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    if (data.session && data.user) {
      await this.setCache(data.session.access_token, data.user);
    }

    return {
      user: data.user,
      session: data.session ? {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      } : null
    };
  }

  async verifySession(token: string): Promise<User> {
    // Try cache first
    const cachedUser = await this.getFromCache(token);
    if (cachedUser) {
      return cachedUser;
    }

    // Verify with Supabase
    const { data: { user }, error } = await this.supabase.auth.getUser(token);

    if (error || !user) {
      await this.clearCache(token);
      throw new UnauthorizedException('Invalid token');
    }

    // Cache the result
    await this.setCache(token, user);
    return user;
  }

  async refreshSession(refreshToken: string): Promise<AuthResponse> {
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (data.session && data.user) {
      await this.setCache(data.session.access_token, data.user);
    }

    return {
      user: data.user,
      session: data.session ? {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      } : null
    };
  }

  async signOut(token: string): Promise<void> {
    await this.clearCache(token);
    const { error } = await this.supabase.auth.signOut();
    if (error) throw new UnauthorizedException(error.message);
  }
} 