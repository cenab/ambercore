import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly supabase: SupabaseClient;
  private initialized = false;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    try {
      new URL(supabaseUrl);
    } catch (error) {
      throw new Error(`Invalid Supabase URL: ${supabaseUrl} ${error}`);
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  async onModuleInit() {
    if (this.initialized) return;

    try {
      const { error } = await this.supabase.auth.getSession();
      if (error) throw error;
      console.log('Supabase connection successful');
      this.initialized = true;
    } catch (error) {
      console.error('Supabase connection failed:', error);
    }
  }

  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}
