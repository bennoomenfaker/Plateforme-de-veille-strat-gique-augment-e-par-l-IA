import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AiEnrichmentController } from './ai-enrichment.controller';
import { AiEnrichmentService } from './ai-enrichment.service';
import { LlmProviderService } from './llm-provider.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'SECRET_KEY_SUPER_FORTE',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AiEnrichmentController],
  providers: [AiEnrichmentService, LlmProviderService, PrismaService],
  exports: [AiEnrichmentService],
})
export class AiEnrichmentModule {}
