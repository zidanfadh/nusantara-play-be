import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getHello() {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  healthCheck() {
    return {
      status: 'ok',
      message: 'Nusantara Play API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
