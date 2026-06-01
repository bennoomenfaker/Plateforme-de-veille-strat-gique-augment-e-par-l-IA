import { Injectable, Logger } from '@nestjs/common';
import * as Parser from 'rss-parser';
import * as crypto from 'crypto';
import axios from 'axios';
import * as cheerio from 'cheerio';

@Injectable()
export class RssService {
  private readonly logger = new Logger(RssService.name);
  private parser = new Parser({
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; VeilleAI/2.0; +https://veilleai.com)',
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
    customFields: {
      item: [
        ['content:encoded', 'contentEncoded'],
        ['description', 'description'],
        ['summary', 'summary'],
      ],
    },
  });

  async fetch(url: string): Promise<any[]> {
    try {
      const feed = await this.parser.parseURL(url);
      const results: any[] = [];

      for (const item of feed.items) {
        const title = item.title?.trim() || 'Sans titre';
        const link = item.link || '';

        // Contenu brut du flux (souvent HTML encodé)
        const rawContent =
          (item as any).contentEncoded ||
          item.content ||
          (item as any).description ||
          (item as any).summary ||
          item.contentSnippet ||
          '';

        // Nettoyer le HTML du contenu RSS
        const cleanedContent = this.cleanHtml(rawContent);

        // Si contenu trop court ET qu'on a un lien → scraper l'article
        let finalContent = cleanedContent;
        if (cleanedContent.length < 200 && link) {
          try {
            const scraped = await this.scrapeArticle(link);
            if (scraped && scraped.length > cleanedContent.length) {
              finalContent = scraped;
            }
          } catch {
            // Garder le contenu RSS si le scraping échoue
          }
        }

        const contentHash = crypto
          .createHash('sha256')
          .update(`${title}${link}`.trim())
          .digest('hex');

        results.push({
          title,
          url: link,
          content: finalContent,
          feedTitle: feed.title || null,
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          contentHash,
        });
      }

      this.logger.log(`[RSS] ${results.length} articles depuis ${url}`);
      return results;
    } catch (error) {
      this.logger.error(`[RSS] Erreur sur ${url}: ${error.message}`);
      return [];
    }
  }

  private cleanHtml(html: string): string {
    if (!html) return '';
    try {
      const $ = cheerio.load(html);
      $(
        'script, style, nav, footer, header, aside, iframe, noscript, figure, .ad, .advertisement',
      ).remove();
      const text = $('body').text() || $.root().text();
      return text
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } catch {
      return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  private async scrapeArticle(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
        maxRedirects: 3,
      });

      const $ = cheerio.load(response.data);

      // Supprimer les éléments non pertinents
      $(
        'script, style, nav, footer, header, aside, iframe, .ad, .advertisement, .cookie, .popup, .modal, .sidebar',
      ).remove();

      // Essayer d'extraire le contenu principal dans cet ordre de priorité
      const selectors = [
        'article',
        '[role="main"]',
        '.article-content',
        '.article-body',
        '.post-content',
        '.entry-content',
        '.content-body',
        'main',
        '.main-content',
      ];

      for (const selector of selectors) {
        const el = $(selector);
        if (el.length && el.text().trim().length > 200) {
          return el.text().replace(/\s+/g, ' ').trim();
        }
      }

      // Fallback : body complet
      return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 10000);
    } catch {
      return '';
    }
  }
}
