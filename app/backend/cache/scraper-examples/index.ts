// Pre-scraped showcase examples for web scraper demo
import { readFileSync } from 'fs';
import { join } from 'path';

export interface ShowcaseExample {
  id: string;
  url: string;
  title: string;
  description: string;
  scrapedAt: number;
  pattern: string;
  engine: string;
  itemCount: number;
  data: any[];
}

function loadExample(filename: string): ShowcaseExample {
  const filePath = join(__dirname, filename);
  const content = readFileSync(filePath, 'utf-8');
  const example = JSON.parse(content);
  return {
    id: filename.replace('.json', ''),
    ...example,
  };
}

// Export showcase examples
export const showcaseExamples: ShowcaseExample[] = [
  loadExample('hepsiburada-laptops.json'),
  loadExample('techcrunch-articles.json'),
];

// Get example by ID
export function getExampleById(id: string): ShowcaseExample | undefined {
  return showcaseExamples.find(ex => ex.id === id);
}

// Get all example summaries (without full data)
export function getExampleSummaries() {
  return showcaseExamples.map(ex => ({
    id: ex.id,
    url: ex.url,
    title: ex.title,
    description: ex.description,
    pattern: ex.pattern,
    itemCount: ex.itemCount,
  }));
}
