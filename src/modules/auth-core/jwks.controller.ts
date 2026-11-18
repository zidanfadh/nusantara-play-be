import { Controller, Get, Header, NotFoundException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Jwks, KeyService } from './key.service';

/** GET /api/auth/jwks.json: public key of our access tokens (Phase 07). */
@Controller('auth')
export class JwksController {
  constructor(private readonly keyService: KeyService) {}

  @Get('jwks.json')
  @Public()
  @Header('Cache-Control', 'public, max-age=300')
  async getJwks(): Promise<Jwks> {
    if (!this.keyService.isEnabled()) {
      throw new NotFoundException();
    }
    return this.keyService.getJwks();
  }
}
