import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PROTService } from './prot.service';
import { CreatePROTDto } from './dto/create-prot.dto';
import { UpdatePROTDto } from './dto/update-prot.dto';
import { QueryPROTDto } from './dto/query-prot.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('prot')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PROTController {
  constructor(private readonly protService: PROTService) {}

  @Post()
  @Roles('kurator_daerah', 'admin_kpoti')
  async create(@Body() createPROTDto: CreatePROTDto) {
    return this.protService.create(createPROTDto);
  }

  @Get()
  @Public()
  async findAll(@Query() query: QueryPROTDto) {
    return this.protService.findAll(query);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return this.protService.findOne(id);
  }

  @Patch(':id')
  @Roles('kurator_daerah', 'admin_kpoti')
  async update(
    @Param('id') id: string,
    @Body() updatePROTDto: UpdatePROTDto,
  ) {
    return this.protService.update(id, updatePROTDto);
  }

  @Put(':id')
  @Roles('kurator_daerah', 'admin_kpoti')
  async updateFull(
    @Param('id') id: string,
    @Body() updatePROTDto: UpdatePROTDto,
  ) {
    return this.protService.update(id, updatePROTDto);
  }

  @Delete(':id')
  @Roles('admin_kpoti')
  async remove(@Param('id') id: string) {
    await this.protService.remove(id);
    return { message: 'PROT deleted successfully' };
  }

  @Post(':id/foto-kegiatan')
  @Roles('kurator_daerah', 'admin_kpoti')
  @UseInterceptors(FilesInterceptor('files', 10))
  async addFotoKegiatan(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    return this.protService.addFotoKegiatan(id, files);
  }

  @Post(':id/video-kegiatan')
  @Roles('kurator_daerah', 'admin_kpoti')
  @UseInterceptors(FilesInterceptor('files', 10))
  async addVideoKegiatan(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    return this.protService.addVideoKegiatan(id, files);
  }

  @Delete(':id/foto-kegiatan/:index')
  @Roles('kurator_daerah', 'admin_kpoti')
  async removeFotoKegiatan(
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.protService.removeFotoKegiatan(id, index);
  }

  @Delete(':id/video-kegiatan/:index')
  @Roles('kurator_daerah', 'admin_kpoti')
  async removeVideoKegiatan(
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.protService.removeVideoKegiatan(id, index);
  }
}
