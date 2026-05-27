import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';

@Injectable()
export class WebService {
  private readonly logger = new Logger(WebService.name);

  private readonly HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
  };

  async fetch(url: string): Promise<any[]> {
    try {
      // D'abord : détecter si c'est un flux RSS déguisé
      if (url.includes('feed') || url.includes('rss') || url.includes('atom')) {
        return this.fetchAsRss(url);
      }

      const response = await axios.get(url, {
        timeout: 20000,
        headers: this.HEADERS,
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);
      const baseUrl = new URL(url).origin;
      const items: any[] = [];

      // Extraire les articles de la page (liens avec titres significatifs)
      const articleSelectors = [
        'article a[href]',
        '.article a[href]',
        '.post a[href]',
        'h1 a[href]', 'h2 a[href]', 'h3 a[href]',
        '.headline a[href]',
        '.story a[href]',
        '.news-item a[href]',
      ];

      const found = new Map<string, any>();

      for (const selector of articleSelectors) {
        $(selector).each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim() ||
            $(el).attr('title') ||
            $(el).find('h1,h2,h3').first().text().trim();

          if (!href || title.length < 15) return;

          let articleUrl = href;
          if (href.startsWith('/')) articleUrl = `${baseUrl}${href}`;
          else if (!href.startsWith('http')) return;

          // Ignorer les liens de navigation
          if (this.isNavigationLink(articleUrl, url)) return;

          const key = articleUrl;
          if (!found.has(key)) {
            found.set(key, { title: title.slice(0, 200), url: articleUrl });
          }
        });
      }

      // Scraper chaque article trouvé (limité à 20)
      const articleList = Array.from(found.values()).slice(0, 20);
      this.logger.log(`[WEB] ${articleList.length} articles trouvés sur ${url}`);

      for (const article of articleList) {
        try {
          const content = await this.scrapeArticleContent(article.url);
          const contentHash = crypto
            .createHash('sha256')
            .update(`${article.title}${article.url}`)
            .digest('hex');

          items.push({
            title: article.title,
            url: article.url,
            content: content || article.title,
            publishedAt: new Date(),
            contentHash,
          });

          // Petit délai pour ne pas surcharger le serveur
          await this.sleep(500);
        } catch {
          // Ignorer les articles qui échouent
        }
      }

      this.logger.log(`[WEB] ${items.length} articles scrapés depuis ${url}`);
      return items;
    } catch (error) {
      this.logger.error(`[WEB] Erreur sur ${url}: ${error.message}`);
      return [];
    }
  }

  private async scrapeArticleContent(url: string): Promise<string> {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: this.HEADERS,
      maxRedirects: 3,
    });

    const $ = cheerio.load(response.data);
    $('script, style, nav, footer, header, aside, iframe, .ad, .cookie, .popup, .sidebar, .menu').remove();

    const selectors = [
      'article', '[role="main"]', '.article-content', '.article-body',
      '.post-content', '.entry-content', '.content-body', 'main', '.main-content',
    ];

    for (const selector of selectors) {
      const el = $(selector);
      if (el.length && el.text().trim().length > 200) {
        return el.text().replace(/\s+/g, ' ').trim().slice(0, 15000);
      }
    }

    return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 10000);
  }

  private async fetchAsRss(url: string): Promise<any[]> {
    // Déléguer au RssService si possible — sinon retourner vide
    return [];
  }

  private isNavigationLink(url: string, basePageUrl: string): boolean {
    const navPatterns = [
      /\/(tag|category|author|page|search|login|register|contact|about)\//i,
      /#/,
      /\.(jpg|jpeg|png|gif|pdf|zip|mp4|mp3)$/i,
    ];
    return navPatterns.some(p => p.test(url));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
