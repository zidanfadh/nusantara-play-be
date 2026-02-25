import { Controller, Get, Param, Query } from '@nestjs/common';
import { DaerahService } from './daerah.service';
import { Public } from '../../common/decorators/public.decorator';
import { DaerahLevel } from './entities/daerah.entity';

@Controller('daerah')
export class DaerahController {
  constructor(private readonly daerahService: DaerahService) {}

  @Get()
  @Public()
  findAll(
    @Query('level') level?: DaerahLevel,
    @Query('provinsi') provinsi?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.daerahService.findAll({
      level,
      provinsi,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    });
  }

  @Get('provinces')
  @Public()
  getProvinces(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.daerahService.findProvinces({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    });
  }

  @Get('stats')
  @Public()
  async getStats() {
    const total = await this.daerahService.count();
    const provinces = await this.daerahService.countByLevel(
      DaerahLevel.PROVINSI,
    );
    const kabupaten = await this.daerahService.countByLevel(
      DaerahLevel.KABUPATEN,
    );
    const kota = await this.daerahService.countByLevel(DaerahLevel.KOTA);
    const kecamatan = await this.daerahService.countByLevel(
      DaerahLevel.KECAMATAN,
    );
    const kelurahan = await this.daerahService.countByLevel(
      DaerahLevel.KELURAHAN,
    );
    const desa = await this.daerahService.countByLevel(DaerahLevel.DESA);

    return {
      total,
      provinces,
      kabupaten,
      kota,
      kecamatan,
      kelurahan,
      desa,
    };
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.daerahService.findById(id);
  }

  @Get(':id/children')
  @Public()
  getChildren(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.daerahService.findChildren(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('by-kode/:kode/children')
  @Public()
  getChildrenByKode(
    @Param('kode') kode: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.daerahService.findChildrenByKode(
      kode,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
