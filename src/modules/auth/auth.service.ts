import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseKey =
      this.configService.get<string>('supabase.serviceRoleKey') ||
      this.configService.get<string>('supabase.anonKey');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Missing Supabase configuration: SUPABASE_URL and SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY are required',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }

  async verifyToken(token: string): Promise<any> {
    const { data, error } = await this.supabase.auth.getUser(token);

    if (error) {
      throw new Error('Invalid token');
    }

    return data.user;
  }
}
