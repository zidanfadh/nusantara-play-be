import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateNftDto } from './dto/create-nft.dto';
import { QueryAdminNftsDto, QueryNftsDto } from './dto/query-nfts.dto';
import { UpdateNftDto } from './dto/update-nft.dto';
import { NftsService } from './nfts.service';

@Controller('nfts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NftsController {
  constructor(private readonly nftsService: NftsService) {}

  @Get()
  @Public()
  findAll(@Query() query: QueryNftsDto) {
    return this.nftsService.findAll(query);
  }

  @Get('admin')
  @Roles(UserRole.ADMIN_KPOTI)
  findAllForAdmin(@Query() query: QueryAdminNftsDto) {
    return this.nftsService.findAllForAdmin(query);
  }

  @Get('slug/:slug')
  @Public()
  findBySlug(@Param('slug') slug: string) {
    return this.nftsService.findBySlug(slug);
  }

  @Get('admin/:id')
  @Roles(UserRole.ADMIN_KPOTI)
  findOneForAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.nftsService.findOneForAdmin(id);
  }

  @Post('upload/image')
  @Roles(UserRole.ADMIN_KPOTI)
  @UseInterceptors(FileInterceptor('file'), AuditInterceptor)
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.nftsService.uploadImage(file);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.nftsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  create(@CurrentUser() user: User, @Body() dto: CreateNftDto) {
    return this.nftsService.create(user.id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateNftDto,
  ) {
    return this.nftsService.update(id, user.id, dto);
  }

  @Post(':id/publish')
  @Roles(UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.nftsService.publish(id, user.id);
  }

  @Post(':id/unpublish')
  @Roles(UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.nftsService.unpublish(id, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.nftsService.remove(id, user.id);
  }
}
