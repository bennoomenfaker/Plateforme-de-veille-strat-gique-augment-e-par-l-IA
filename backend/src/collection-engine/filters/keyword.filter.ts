import { Injectable } from '@nestjs/common';

@Injectable()
export class KeywordFilter {

  // Filtrage INCLUDE : garder les items qui contiennent au moins un keyword
  filterInclude(items: any[], keywords: string[]): any[] {
    if (!keywords || keywords.length === 0) return items;
    const lower = keywords.map((k) => k.toLowerCase());
    return items.filter((item) => {
      const text = this.extractText(item);
      return lower.some((kw) => text.includes(kw));
    });
  }

  // Filtrage EXCLUDE : supprimer les items qui contiennent un keyword exclu
  filterExclude(items: any[], keywords: string[]): any[] {
    if (!keywords || keywords.length === 0) return items;
    const lower = keywords.map((k) => k.toLowerCase());
    return items.filter((item) => {
      const text = this.extractText(item);
      return !lower.some((kw) => text.includes(kw));
    });
  }

  // Méthode legacy (compatibilité)
  filter(items: any[], keywords: string[]): any[] {
    return this.filterInclude(items, keywords);
  }

  // Extraction texte depuis title + content + description RSS
  private extractText(item: any): string {
    return [
      item.title || '',
      item.content || '',
      item.content_raw || '',
      item.description || '',
    ]
      .join(' ')
      .toLowerCase();
  }
}
