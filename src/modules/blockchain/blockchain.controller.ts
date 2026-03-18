import {
  Controller,
  Get,
  Post,
  Param,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('prot')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get(':id/blockchain-proof')
  @Public()
  async getBlockchainProof(@Param('id') protId: string) {
    const result = await this.blockchainService.getProofForProt(protId);
    if (!result) {
      throw new NotFoundException(`No blockchain proof found for PROT ${protId}`);
    }
    return result;
  }

  @Post(':id/blockchain-proof/reanchor')
  @Roles(UserRole.ADMIN_KPOTI)
  async reanchorProof(@Param('id') protId: string) {
    return this.blockchainService.triggerReanchor(protId);
  }
}
