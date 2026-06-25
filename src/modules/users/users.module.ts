import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { DaerahModule } from '../daerah/daerah.module';
import { SupabaseModule } from '../supabase';
import { NotificationsModule } from '../notifications';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    DaerahModule,
    SupabaseModule,
    NotificationsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
