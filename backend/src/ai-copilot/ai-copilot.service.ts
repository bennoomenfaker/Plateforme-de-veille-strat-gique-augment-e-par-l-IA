import { Injectable, Logger } from '@nestjs/common';
import { LlmProviderService } from '../ai-enrichment/llm-provider.service';

@Injectable()
export class AiCopilotService {
  private readonly logger = new Logger(AiCopilotService.name);

  constructor(private readonly llm: LlmProviderService) {}

  async generate(prompt: string): Promise<string> {
    try {
      return await this.llm.generate(prompt);
    } catch (e) {
      this.logger.error('LLM call failed', e instanceof Error ? e.message : String(e));
      throw e;
    }
  }
}
