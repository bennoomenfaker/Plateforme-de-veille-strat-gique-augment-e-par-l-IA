import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class LlmProviderService {
  private readonly logger = new Logger(LlmProviderService.name);

  // Ollama
  private readonly ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  private readonly ollamaModel = process.env.OLLAMA_MODEL || 'mistral';

  // Mistral API
  private readonly mistralApiKey = process.env.MISTRAL_API_KEY || '';
  private readonly mistralModel = process.env.MISTRAL_MODEL || 'mistral-large-latest';

  // Groq API
  private readonly groqApiKey = process.env.GROQ_API_KEY || '';
  private readonly groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  // Rate limiting
  private readonly delayMs = parseInt(process.env.LLM_DELAY_MS || '600', 10);

  private get modelUsed(): string {
    return process.env.MISTRAL_API_KEY
      ? `mistral:${this.mistralModel}`
      : process.env.GROQ_API_KEY
        ? `groq:${this.groqModel}`
        : `ollama:${this.ollamaModel}`;
  }

  get primaryModel(): string {
    return this.modelUsed;
  }

  async generate(prompt: string): Promise<string> {
    const errors: string[] = [];

    // 1. Try Mistral API (with retry on 429)
    if (this.mistralApiKey) {
      try {
        const res = await this.callWithRetry(() => this.callMistral(prompt), 'Mistral');
        this.logger.log(`Mistral API responded successfully`);
        return res;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Mistral: ${msg}`);
        this.logger.warn(`Mistral API unavailable, trying next...`);
      }
    }

    // 2. Try Groq API (with retry on 429)
    if (this.groqApiKey) {
      try {
        const res = await this.callWithRetry(() => this.callGroq(prompt), 'Groq');
        this.logger.log(`Groq API responded successfully`);
        return res;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Groq: ${msg}`);
        this.logger.warn(`Groq API unavailable, trying next...`);
      }
    }

    // 3. Try Ollama
    try {
      const res = await this.callOllama(prompt);
      this.logger.log(`Ollama responded successfully`);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Ollama: ${msg}`);
    }

    this.logger.error(`All providers failed: ${errors.join(' | ')}`);
    throw new Error(`LLM unavailable: ${errors.join('; ')}`);
  }

  private async callWithRetry(
    fn: () => Promise<string>,
    name: string,
    maxRetries = 3,
  ): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (e: any) {
        const is429 = e?.response?.status === 429;
        const is5xx = e?.response?.status >= 500 && e?.response?.status < 600;

        if ((is429 || is5xx) && attempt < maxRetries) {
          const wait = is429
            ? parseInt(e.response?.headers?.['retry-after'] || '15', 10) * 1000
            : 2000 * attempt;
          this.logger.warn(
            `${name} rate-limited (${e.response?.status}), retry ${attempt}/${maxRetries} in ${wait}ms...`,
          );
          await sleep(wait);
          continue;
        }
        throw e;
      }
    }
    throw new Error(`${name} failed after ${maxRetries} retries`);
  }

  private async callOllama(prompt: string): Promise<string> {
    await sleep(this.delayMs);
    const res = await axios.post(
      `${this.ollamaUrl}/api/generate`,
      { model: this.ollamaModel, prompt, stream: false, keep_alive: '5m', options: { temperature: 0.3, num_predict: 1000 } },
      { timeout: 120000 },
    );
    return res.data.response || '';
  }

  private async callMistral(prompt: string): Promise<string> {
    await sleep(this.delayMs);
    const res = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      { model: this.mistralModel, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 1000 },
      { headers: { Authorization: `Bearer ${this.mistralApiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 },
    );
    return res.data?.choices?.[0]?.message?.content || '';
  }

  private async callGroq(prompt: string): Promise<string> {
    await sleep(this.delayMs);
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      { model: this.groqModel, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 1000 },
      { headers: { Authorization: `Bearer ${this.groqApiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 },
    );
    return res.data?.choices?.[0]?.message?.content || '';
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
    if (this.mistralApiKey || this.groqApiKey) return true;
    try {
      await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}
