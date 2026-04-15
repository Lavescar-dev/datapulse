import puppeteer, { type Browser } from 'puppeteer';
import { SCRAPER_CONFIG } from '../config/scrapers';

let sharedBrowserPromise: Promise<Browser> | null = null;

async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = puppeteer.launch({
      ...SCRAPER_CONFIG.PUPPETEER_OPTIONS,
      args: [...SCRAPER_CONFIG.PUPPETEER_OPTIONS.args],
    });
  }

  return sharedBrowserPromise;
}

export async function fetchPageWithBrowser(url: string, userAgent: string): Promise<string> {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 1440, height: 1200 });
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: SCRAPER_CONFIG.SCRAPER_TIMEOUT,
    });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => undefined);
    return await page.content();
  } finally {
    await page.close();
  }
}

export async function evaluateInBrowser<T>(
  url: string,
  userAgent: string,
  pageFunction: () => T | Promise<T>,
): Promise<T> {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 1440, height: 1200 });
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: SCRAPER_CONFIG.SCRAPER_TIMEOUT,
    });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => undefined);
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 }).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return await page.evaluate(pageFunction);
  } finally {
    await page.close();
  }
}

export async function closeSharedBrowser(): Promise<void> {
  if (!sharedBrowserPromise) return;

  const browser = await sharedBrowserPromise;
  await browser.close();
  sharedBrowserPromise = null;
}
