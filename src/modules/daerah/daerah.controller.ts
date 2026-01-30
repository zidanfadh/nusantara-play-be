import { Controller, Get, Param, Query } from '@nestjs/common';
import { DaerahService } from './daerah.service';
import { Public } from '../../common/decorators/public.decorator';
import { DaerahLevel } from './entities/daerah.entity';

@Controller('daerah')
export class DaerahController {
  constructor(private readonly daerahService: DaerahService) {}

  @Get()
  @Public()
  findAll(@Query('level') level?: DaerahLevel, @Query('provinsi') provinsi?: string) {
    if (level) {
      return this.daerahService.findByLevel(level);
    }
    if (provinsi) {
      return this.daerahService.findByProvinsi(provinsi);
    }
    return this.daerahService.findAll();
  }

  @Get('provinces')
  @Public()
  getProvinces() {
    return this.daerahService.findProvinces();
  }

  @Get('stats')
  @Public()
  async getStats() {
    const total = await this.daerahService.count();
    const provinces = await this.daerahService.countByLevel(DaerahLevel.PROVINSI);
    const kabupaten = await this.daerahService.countByLevel(DaerahLevel.KABUPATEN);
    const kota = await this.daerahService.countByLevel(DaerahLevel.KOTA);

    return {
      total,
      provinces,
      kabupaten,
      kota,
    };
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.daerahService.findById(id);
  }

  @Get(':id/children')
  @Public()
  getChildren(@Param('id') id: string) {
    return this.daerahService.findChildren(id);
  }
}
