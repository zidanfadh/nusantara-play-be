import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import databaseConfig from './database.config';
import supabaseConfig from './supabase.config';
import awsConfig from './aws.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      load: [appConfig, databaseConfig, supabaseConfig, awsConfig],
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
  ],
})
export class ConfigModule {}
