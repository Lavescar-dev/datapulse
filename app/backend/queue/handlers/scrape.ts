// Scrape job handler with Puppeteer and Cheerio fallback
import type { Job } from 'bullmq';
import type { ScrapeJobData, ScrapeJobResult } from '../../../shared/types/jobs';
import { scrapeWithPuppeteer } from '../../services/scraper/engine';
import { fetchAndScrape, scrapeWithCheerio } from '../../services/scraper/static';
import { urlCache } from '../../services/scraper/cache';

function buildFallbackWarning(puppeteerMessage?: string) {
  if (puppeteerMessage?.toLowerCase().includes('chrome') || puppeteerMessage?.toLowerCase().includes('browser')) {
    return 'Tarayici motoru mevcut degil, statik HTML modu kullanildi. JavaScript ile yuklenen alanlarda eksik veri olabilir.';
  }

  return 'Dinamik tarama tamamlanamadi, statik HTML modu kullanildi. JavaScript ile yuklenen alanlarda eksik veri olabilir.';
}

function buildUserFacingFailure(puppeteerMessage?: string, staticMessage?: string) {
  if (staticMessage) {
    return `Sayfa statik modda da taranamadi: ${staticMessage}`;
  }

  if (puppeteerMessage?.toLowerCase().includes('chrome') || puppeteerMessage?.toLowerCase().includes('browser')) {
    return 'Tarayici motoru mevcut degil ve statik HTML modu ile de veri alinamadi.';
  }

  return 'Sayfa taranamadi. Dinamik tarama ve statik HTML modu basarisiz oldu.';
}

export async function processScrapeJob(job: Job<ScrapeJobData>): Promise<ScrapeJobResult> {
  const { url, selector, autoDetect, sessionId } = job.data;

  try {
    // Check URL cache (10-minute cooldown)
    if (urlCache.isInCooldown(url)) {
      const remainingSeconds = urlCache.getRemainingCooldown(url);
      return {
        success: false,
        error: `URL was scraped recently. Please wait ${remainingSeconds} seconds before scraping again.`,
        url,
        scrapedAt: Date.now(),
      };
    }

    console.log(`🔍 Scraping ${url} with ${selector ? `selector: ${selector}` : 'auto-detect mode'}`);

    // Update job progress
    await job.updateProgress(10);

    // Try Puppeteer first (for JavaScript-heavy sites)
    const puppeteerResult = await scrapeWithPuppeteer({
      url,
      selector,
      autoDetect: autoDetect ?? true,
      timeout: 30000,
    });

    // Return Puppeteer result
    if (puppeteerResult.success) {
      // Add to cache on success
      urlCache.add(url, job.id);

      await job.updateProgress(100);

      return {
        success: true,
        data: puppeteerResult.data,
        url,
        scrapedAt: Date.now(),
        itemCount: puppeteerResult.data?.length || 0,
          pattern: puppeteerResult.pattern,
          engine: 'puppeteer',
        };
    }

    await job.updateProgress(80);

    console.log('⚠️  Puppeteer unavailable or failed, trying static fallback...');

    const cheerioResult: {
      success: boolean;
      data?: any[];
      pattern?: string;
      error?: string;
      html?: string;
    } = puppeteerResult.html
        ? {
          ...scrapeWithCheerio({
            html: puppeteerResult.html,
            baseUrl: url,
            selector,
            autoDetect: autoDetect ?? true,
          }),
          html: puppeteerResult.html,
        }
      : await fetchAndScrape(url, {
          selector,
          autoDetect: autoDetect ?? true,
        });

    if (cheerioResult.success) {
      urlCache.add(url, job.id);

      await job.updateProgress(100);

      return {
        success: true,
        data: cheerioResult.data,
        url,
        scrapedAt: Date.now(),
        itemCount: cheerioResult.data?.length || 0,
        pattern: cheerioResult.pattern,
        engine: 'cheerio',
        attemptedEngine: 'puppeteer',
        fallbackUsed: true,
        warning: buildFallbackWarning(puppeteerResult.error),
      };
    }

    // Both failed
    return {
      success: false,
      error: buildUserFacingFailure(puppeteerResult.error, cheerioResult.error),
      url,
      scrapedAt: Date.now(),
      attemptedEngine: 'puppeteer',
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return {
      success: false,
      error: 'Scraping islemi beklenmeyen bir hata nedeniyle tamamlanamadi.',
      url,
      scrapedAt: Date.now(),
    };
  }
}
