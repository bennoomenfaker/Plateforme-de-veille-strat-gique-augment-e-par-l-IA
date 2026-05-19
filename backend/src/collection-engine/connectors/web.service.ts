// backend/src/collection-engine/connectors/web.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';

@Injectable()
export class WebService {
  private readonly logger = new Logger(WebService.name);

  async fetch(url: string): Promise<any[]> {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'VeilleAI/1.0' },
      });

      const $ = cheerio.load(response.data);
      const items: any[] = [];
      const baseUrl = new URL(url).origin;

      // Extraire les liens articles de la page
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        const title = $(el).text().trim();

        if (!href || title.length < 10) return;

        // Construire URL absolue
        let articleUrl = href;
        if (href.startsWith('/')) {
          articleUrl = `${baseUrl}${href}`;
        } else if (!href.startsWith('http')) {
          return;
        }

        const hash = crypto
          .createHash('sha256')
          .update(`${title}${articleUrl}`.trim())
          .digest('hex');

        items.push({
          title,
          url: articleUrl,
          content: title,
          publishedAt: new Date(),
          contentHash: hash,
        });
      });

      // Dédupliquer par hash en mémoire
      const seen = new Set<string>();
      const unique = items.filter(item => {
        if (seen.has(item.contentHash)) return false;
        seen.add(item.contentHash);
        return true;
      });

      this.logger.log(`[WEB] ${unique.length} liens extraits de ${url}`);
      return unique.slice(0, 50); // Limiter à 50 articles par page

    } catch (error) {
      this.logger.error(`[WEB] Erreur sur ${url}: ${error.message}`);
      return [];
    }
  }
}
