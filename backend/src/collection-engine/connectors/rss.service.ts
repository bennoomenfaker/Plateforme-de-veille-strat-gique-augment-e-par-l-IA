import { Injectable, Logger } from '@nestjs/common';
import * as Parser from 'rss-parser';
import * as crypto from 'crypto';

@Injectable()
export class RssService {
  private readonly logger = new Logger(RssService.name);
  private parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'VeilleAI/1.0' } });

  async fetch(url: string): Promise<any[]> {
    try {
      const feed = await this.parser.parseURL(url);
      return feed.items.map(item => {
        const title = item.title || 'Sans titre';
        const link = item.link || '';
        const content = item.contentSnippet || item.content || '';
        const contentHash = crypto
          .createHash('sha256')
          .update(`${title}${link}`.trim())
          .digest('hex');
        return {
          title,
          url: link,
          content,
          feedTitle: feed.title || null,
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          contentHash,
        };
      });
    } catch (error) {
      this.logger.error(`[RSS] Erreur sur ${url}: ${error.message}`);
      return [];
    }
  }
}
