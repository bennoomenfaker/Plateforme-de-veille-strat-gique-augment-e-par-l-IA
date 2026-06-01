import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class LlmProviderService {
  private readonly logger = new Logger(LlmProviderService.name);
  private readonly ollamaUrl =
    process.env.OLLAMA_URL || 'http://localhost:11434';
  private readonly model = process.env.OLLAMA_MODEL || 'mistral';

  async generate(prompt: string): Promise<string> {
    try {
      const res = await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: this.model,
          prompt,
          stream: false,
          keep_alive: '5m',
          options: { temperature: 0.3, num_predict: 1000 },
        },
        { timeout: 120000 },
      );
      return res.data.response || '';
    } catch (err) {
      this.logger.error(`Ollama error: ${err.message}`);
      throw new Error(`LLM unavailable: ${err.message}`);
    }
  }

  parseJsonResponse(raw: string): any {
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
    return null;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}
