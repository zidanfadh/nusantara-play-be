import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  Delete,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const url = await this.storageService.uploadFile(file, 'images');
    return {
      url,
      message: 'Image uploaded successfully',
    };
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const url = await this.storageService.uploadFile(file, 'images/avatars');
    return {
      url,
      message: 'Avatar uploaded successfully',
    };
  }

  @Post('document')
  @Roles(UserRole.KURATOR_DAERAH, UserRole.PAKAR, UserRole.ADMIN_KPOTI)
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const url = await this.storageService.uploadFile(file, 'documents');
    return {
      url,
      message: 'Document uploaded successfully',
    };
  }

  @Post('video')
  @Roles(UserRole.KURATOR_DAERAH, UserRole.ADMIN_KPOTI)
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const url = await this.storageService.uploadFile(file, 'videos');
    return {
      url,
      message: 'Video uploaded successfully',
    };
  }

  @Delete('file')
  @Roles(UserRole.KURATOR_DAERAH, UserRole.ADMIN_KPOTI)
  async deleteFile(@Body('url') url: string) {
    if (!url) {
      throw new BadRequestException('No URL provided');
    }

    await this.storageService.deleteFile(url);
    return {
      message: 'File deleted successfully',
    };
  }
}
