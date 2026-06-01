import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfScraperService {
  private readonly logger = new Logger(PdfScraperService.name);
  private readonly uploadDir = './uploads/pdfs';

  constructor() {
    // Créer le dossier uploads si inexistant
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async fetchPdfLinks(pageUrl: string): Promise<any[]> {
    try {
      const response = await axios.get(pageUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'VeilleAI/1.0' },
      });

      const $ = cheerio.load(response.data);
      const baseUrl = new URL(pageUrl).origin;
      const items: any[] = [];

      $('a[href$=".pdf"]').each((_, el) => {
        const href = $(el).attr('href');
        const title = $(el).text().trim() || 'Document PDF';

        if (!href) return;

        let pdfUrl = href;
        if (href.startsWith('/')) {
          pdfUrl = `${baseUrl}${href}`;
        } else if (!href.startsWith('http')) {
          return;
        }

        const hash = crypto
          .createHash('sha256')
          .update(`${title}${pdfUrl}`.trim())
          .digest('hex');

        items.push({
          title,
          url: pdfUrl,
          content: null,
          publishedAt: new Date(),
          contentHash: hash,
          isPdf: true,
        });
      });

      this.logger.log(
        `[PDF-SCRAPER] ${items.length} PDF trouvés sur ${pageUrl}`,
      );
      return items.slice(0, 20); // Limiter à 20 PDFs
    } catch (error) {
      this.logger.error(
        `[PDF-SCRAPER] Erreur sur ${pageUrl}: ${error.message}`,
      );
      return [];
    }
  }

  async downloadPdf(pdfUrl: string, filename: string): Promise<string | null> {
    try {
      const response = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 'User-Agent': 'VeilleAI/1.0' },
      });

      const filePath = path.join(this.uploadDir, filename);
      fs.writeFileSync(filePath, response.data);

      this.logger.log(`[PDF-SCRAPER] PDF téléchargé: ${filePath}`);
      return filePath;
    } catch (error) {
      this.logger.error(
        `[PDF-SCRAPER] Erreur téléchargement ${pdfUrl}: ${error.message}`,
      );
      return null;
    }
  }
}
