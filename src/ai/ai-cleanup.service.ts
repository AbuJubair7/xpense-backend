import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ChatMessage } from './entities/chat-message.entity';

@Injectable()
export class AiCleanupService {
  private readonly logger = new Logger(AiCleanupService.name);

  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
  ) {}

  @Cron('0 0 * * *')
  async handleCron() {
    this.logger.log('Running nightly chat cleanup job...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const result = await this.chatMessageRepository.delete({
        createdAt: LessThan(thirtyDaysAgo),
      });
      this.logger.log(`Deleted ${result?.affected || 0} old chat messages.`);
    } catch (error) {
      this.logger.error('Failed to clean up old chat messages', error);
    }
  }
}
