import { Injectable } from '@nestjs/common';

@Injectable()
export class KeywordFilter {
  filter(items: any[], keywords: string[]) {
    if (!keywords || keywords.length === 0) return items;
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    return items.filter(item => {
      const textToSearch = `${item.title} ${item.content}`.toLowerCase();
      return lowerKeywords.some(kw => textToSearch.includes(kw));
    });
  }
}
