import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
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

  async changePassword(
    supabaseUserId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    try {
      // First, get the user's email to verify current password
      const { data: userData, error: userError } = await this.supabase.auth.admin.getUserById(supabaseUserId);

      if (userError || !userData.user) {
        throw new BadRequestException('User not found');
      }

      // Verify current password by attempting to sign in
      const { error: signInError } = await this.supabase.auth.signInWithPassword({
        email: userData.user.email!,
        password: currentPassword,
      });

      if (signInError) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      // Update password using admin API
      const { error: updateError } = await this.supabase.auth.admin.updateUserById(
        supabaseUserId,
        { password: newPassword },
      );

      if (updateError) {
        throw new BadRequestException(`Failed to update password: ${updateError.message}`);
      }
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Failed to change password');
    }
  }
}
