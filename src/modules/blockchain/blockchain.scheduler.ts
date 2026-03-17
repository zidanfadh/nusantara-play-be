import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BlockchainService } from './blockchain.service';

@Injectable()
export class BlockchainScheduler {
  private readonly logger = new Logger(BlockchainScheduler.name);

  constructor(private readonly blockchainService: BlockchainService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryPendingProofs() {
    this.logger.log('Running blockchain proof retry job...');
    await this.blockchainService.retryPendingProofs();
  }
}
