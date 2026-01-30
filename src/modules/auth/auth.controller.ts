import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  @Get('health')
  @Public()
  healthCheck() {
    return {
      status: 'ok',
      message: 'Auth service is running',
      timestamp: new Date().toISOString(),
    };
  }
}
