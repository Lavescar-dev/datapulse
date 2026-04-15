// Technology detection service (Wappalyzer-like patterns)
import * as cheerio from 'cheerio';
import type { TechDetection } from '../../../shared/types/jobs';

interface TechPattern {
  name: string;
  category: string;
  patterns: {
    html?: RegExp[];
    headers?: { [key: string]: RegExp };
    script?: RegExp[];
    meta?: { [key: string]: RegExp };
    cookies?: RegExp[];
  };
}

const techPatterns: TechPattern[] = [
  // Frameworks
  {
    name: 'React',
    category: 'JavaScript Framework',
    patterns: {
      html: [/react/i],
      script: [/react\./, /_react/],
    },
  },
  {
    name: 'Vue.js',
    category: 'JavaScript Framework',
    patterns: {
      html: [/data-v-[a-f0-9]{8}/],
      script: [/vue\.js/, /vue\.min\.js/],
    },
  },
  {
    name: 'Next.js',
    category: 'JavaScript Framework',
    patterns: {
      html: [/__next/, /_next\//],
      script: [/_next\/static\//],
    },
  },
  {
    name: 'Astro',
    category: 'Static Site Generator',
    patterns: {
      html: [/astro-/],
      meta: { generator: /astro/i },
    },
  },
  {
    name: 'WordPress',
    category: 'CMS',
    patterns: {
      html: [/wp-content/, /wp-includes/],
      meta: { generator: /wordpress/i },
    },
  },
  // Analytics
  {
    name: 'Google Analytics',
    category: 'Analytics',
    patterns: {
      script: [/google-analytics\.com\/analytics\.js/, /googletagmanager\.com\/gtag\/js/],
    },
  },
  {
    name: 'Plausible',
    category: 'Analytics',
    patterns: {
      script: [/plausible\.io\/js\/script/],
    },
  },
  // CDN
  {
    name: 'Cloudflare',
    category: 'CDN',
    patterns: {
      headers: { server: /cloudflare/i },
    },
  },
  {
    name: 'Fastly',
    category: 'CDN',
    patterns: {
      headers: { 'x-served-by': /fastly/i },
    },
  },
  // Web Servers
  {
    name: 'Nginx',
    category: 'Web Server',
    patterns: {
      headers: { server: /nginx/i },
    },
  },
  {
    name: 'Apache',
    category: 'Web Server',
    patterns: {
      headers: { server: /apache/i },
    },
  },
  // UI Libraries
  {
    name: 'Bootstrap',
    category: 'UI Framework',
    patterns: {
      html: [/bootstrap/i],
    },
  },
  {
    name: 'Tailwind CSS',
    category: 'CSS Framework',
    patterns: {
      html: [/tailwind/, /tw-/],
    },
  },
  // Ecommerce
  {
    name: 'Shopify',
    category: 'Ecommerce',
    patterns: {
      html: [/cdn\.shopify\.com/],
    },
  },
  // Tag Managers
  {
    name: 'Google Tag Manager',
    category: 'Tag Manager',
    patterns: {
      script: [/googletagmanager\.com\/gtm\.js/],
    },
  },
];

export async function detectTechnology(url: string, headers?: { [key: string]: string }): Promise<TechDetection[]> {
  const detections: TechDetection[] = [];

  try {
    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    const response = await fetch(fullUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Use provided headers or extract from response
    const responseHeaders = headers || (() => {
      const collected: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        collected[key] = value;
      });
      return collected;
    })();

    for (const tech of techPatterns) {
      let confidence = 0;
      let matches = 0;

      // Check HTML patterns
      if (tech.patterns.html) {
        for (const pattern of tech.patterns.html) {
          if (pattern.test(html)) {
            matches++;
            confidence += 30;
          }
        }
      }

      // Check script sources
      if (tech.patterns.script) {
        $('script').each((_, element) => {
          const src = $(element).attr('src') || '';
          const content = $(element).html() || '';
          for (const pattern of tech.patterns.script ?? []) {
            if (pattern.test(src) || pattern.test(content)) {
              matches++;
              confidence += 40;
            }
          }
        });
      }

      // Check meta tags
      if (tech.patterns.meta) {
        for (const [metaName, pattern] of Object.entries(tech.patterns.meta)) {
          const metaContent = $(`meta[name="${metaName}"]`).attr('content') || '';
          if (pattern.test(metaContent)) {
            matches++;
            confidence += 50;
          }
        }
      }

      // Check headers
      if (tech.patterns.headers) {
        for (const [headerName, pattern] of Object.entries(tech.patterns.headers)) {
          const headerValue = responseHeaders[headerName.toLowerCase()] || '';
          if (pattern.test(headerValue)) {
            matches++;
            confidence += 60;
          }
        }
      }

      // Add detection if confidence > 0
      if (confidence > 0) {
        detections.push({
          name: tech.name,
          category: tech.category,
          confidence: Math.min(confidence, 100),
        });
      }
    }

    // Sort by confidence (highest first)
    detections.sort((a, b) => b.confidence - a.confidence);

    return detections;
  } catch (error) {
    console.error(`Technology detection failed for ${url}:`, error);
    return [];
  }
}
