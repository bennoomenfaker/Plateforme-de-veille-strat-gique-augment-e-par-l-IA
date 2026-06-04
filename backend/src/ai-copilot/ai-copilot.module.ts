import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AiCopilotController } from './ai-copilot.controller';
import { AiCopilotService } from './ai-copilot.service';
import { LlmProviderService } from '../ai-enrichment/llm-provider.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'SECRET_KEY_SUPER_FORTE',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AiCopilotController],
  providers: [AiCopilotService, LlmProviderService],
})
export class AiCopilotModule {}
