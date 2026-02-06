import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseUser {
  id: string;
  email: string | null;
  phone: string | null;
  user_metadata: Record<string, any>;
  created_at: string;
  updated_at?: string;
  avatar_url?: string;
  full_name?: string;
  name?: string;
}

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly adminClient: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseServiceKey = this.configService.get<string>(
      'supabase.serviceRoleKey',
    );

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Missing Supabase configuration: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
      );
    }

    this.adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async fetchUserById(userId: string): Promise<SupabaseUser> {
    const { data, error } =
      await this.adminClient.auth.admin.getUserById(userId);

    if (error) {
      this.logger.error(`Failed to fetch user from Supabase: ${error.message}`);
      throw new Error(`Supabase API error: ${error.message}`);
    }

    if (!data.user) {
      throw new Error(`User not found in Supabase: ${userId}`);
    }

    return {
      id: data.user.id,
      email: data.user.email ?? null,
      phone: data.user.phone ?? null,
      user_metadata: data.user.user_metadata,
      created_at: data.user.created_at,
      updated_at: data.user.updated_at,
      avatar_url: data.user.user_metadata?.avatar_url,
      full_name: data.user.user_metadata?.full_name,
      name: data.user.user_metadata?.name,
    };
  }
}
