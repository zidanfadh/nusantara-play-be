import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { buildDataSourceOptions } from '../config/data-source-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // Shared with the migration CLI (src/config/typeorm.config.ts).
        ...buildDataSourceOptions((key) => configService.get<string>(key)),
        logging: configService.get<string>('app.env') === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}
