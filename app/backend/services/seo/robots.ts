// Robots.txt and sitemap.xml parser service
import { parseString } from 'xml2js';
import type { RobotsData, SitemapData } from '../../../shared/types/jobs';

export async function parseRobotsTxt(url: string): Promise<RobotsData> {
  try {
    // Clean URL and construct robots.txt URL
    const baseUrl = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const robotsUrl = `https://${baseUrl}/robots.txt`;

    const response = await fetch(robotsUrl);

    if (!response.ok) {
      return { exists: false };
    }

    const content = await response.text();

    // Parse robots.txt
    const userAgents: { agent: string; rules: string[] }[] = [];
    const sitemaps: string[] = [];

    let currentAgent: string | null = null;
    let currentRules: string[] = [];

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip comments and empty lines
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      // Parse User-agent
      const agentMatch = trimmedLine.match(/^User-agent:\s*(.+)$/i);
      if (agentMatch) {
        // Save previous agent if exists
        if (currentAgent && agentMatch[1]) {
          userAgents.push({ agent: currentAgent, rules: currentRules });
        }
        currentAgent = agentMatch[1]?.trim() ?? null;
        currentRules = [];
        continue;
      }

      // Parse Sitemap
      const sitemapMatch = trimmedLine.match(/^Sitemap:\s*(.+)$/i);
      if (sitemapMatch) {
        if (sitemapMatch[1]) {
          sitemaps.push(sitemapMatch[1].trim());
        }
        continue;
      }

      // Parse rules (Disallow, Allow, Crawl-delay, etc.)
      if (currentAgent) {
        currentRules.push(trimmedLine);
      }
    }

    // Add last agent
    if (currentAgent) {
      userAgents.push({ agent: currentAgent, rules: currentRules });
    }

    return {
      exists: true,
      content,
      userAgents: userAgents.length > 0 ? userAgents : undefined,
      sitemaps: sitemaps.length > 0 ? sitemaps : undefined,
    };
  } catch (error) {
    console.error(`Robots.txt parsing failed for ${url}:`, error);
    return { exists: false };
  }
}

export async function parseSitemap(url: string): Promise<SitemapData> {
  try {
    // Clean URL and construct sitemap.xml URL
    const baseUrl = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const sitemapUrl = `https://${baseUrl}/sitemap.xml`;

    const response = await fetch(sitemapUrl);

    if (!response.ok) {
      return { exists: false };
    }

    const xml = await response.text();

    // Parse XML
    return await new Promise<SitemapData>((resolve, reject) => {
      parseString(xml, (err, result) => {
        if (err) {
          resolve({ exists: false });
          return;
        }

        const urls: string[] = [];
        let lastModified: string | undefined;

        // Handle standard sitemap format
        if (result.urlset && result.urlset.url) {
          for (const urlEntry of result.urlset.url) {
            if (urlEntry.loc && urlEntry.loc[0]) {
              urls.push(urlEntry.loc[0] as string);
            }
            if (!lastModified && urlEntry.lastmod && urlEntry.lastmod[0]) {
              lastModified = urlEntry.lastmod[0] as string;
            }
          }
        }

        // Handle sitemap index format
        if (result.sitemapindex && result.sitemapindex.sitemap) {
          for (const sitemapEntry of result.sitemapindex.sitemap) {
            if (sitemapEntry.loc && sitemapEntry.loc[0]) {
              urls.push(sitemapEntry.loc[0] as string);
            }
          }
        }

        resolve({
          exists: true,
          urls: urls.length > 0 ? urls.slice(0, 100) : undefined, // Limit to first 100 URLs
          urlCount: urls.length,
          lastModified,
        });
      });
    });
  } catch (error) {
    console.error(`Sitemap parsing failed for ${url}:`, error);
    return { exists: false };
  }
}
