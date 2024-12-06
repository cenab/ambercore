import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DatabaseService {
  private readonly supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
    );
  }

  async onModuleInit() {
    // Add connection error handling
    try {
      await this.supabase.from('your_table').select('*').limit(1);
      console.log('Supabase connection successful');
    } catch (error) {
      console.error('Supabase connection failed:', error);
    }
  }

  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}
