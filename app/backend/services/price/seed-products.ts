/**
 * Pre-configured popular products for demo showcase
 * These are real product categories from major Turkish e-commerce sites
 */

export interface SeedProduct {
  url: string;
  query: string;
  alternateQueries?: string[];
  marketplace: 'trendyol' | 'hepsiburada' | 'n11' | 'amazon-tr';
  category: string;
  description: string;
  showcasePrice: number;
  showcaseAvailable?: boolean;
}

export const SEED_PRODUCTS: SeedProduct[] = [
  // Trendyol Products
  {
    url: 'https://www.trendyol.com/sr?q=iphone%2016%20pro%20max%20256%20gb',
    query: 'iphone 16 pro max 256 gb',
    alternateQueries: [
      'apple iphone 16 pro max 256 gb',
      'iphone 16 pro max 256 gb cep telefonu',
    ],
    marketplace: 'trendyol',
    category: 'Electronics',
    description: 'Apple iPhone 16 Pro Max 256 GB',
    showcasePrice: 94999,
    showcaseAvailable: true,
  },
  {
    url: 'https://www.trendyol.com/sr?q=samsung%20galaxy%20s25%20ultra%20256%20gb',
    query: 'samsung galaxy s25 ultra 256 gb',
    marketplace: 'trendyol',
    category: 'Electronics',
    description: 'Samsung Galaxy S25 Ultra 256 GB',
    showcasePrice: 82999,
    showcaseAvailable: true,
  },
  {
    url: 'https://www.trendyol.com/sr?q=roborock%20qrevo%20master%20robot%20supurge',
    query: 'roborock qrevo master robot supurge',
    marketplace: 'trendyol',
    category: 'Home Appliances',
    description: 'Roborock Qrevo Master Robot Supurge',
    showcasePrice: 36999,
    showcaseAvailable: true,
  },
  {
    url: 'https://www.trendyol.com/sr?q=playstation%205%20slim%20digital%20edition',
    query: 'playstation 5 slim digital edition',
    marketplace: 'trendyol',
    category: 'Gaming',
    description: 'Sony PlayStation 5 Slim Digital Edition',
    showcasePrice: 27999,
    showcaseAvailable: false,
  },

  // Hepsiburada Products
  {
    url: 'https://www.hepsiburada.com/ara?q=iphone%2016%20128%20gb',
    query: 'iphone 16 128 gb',
    marketplace: 'hepsiburada',
    category: 'Electronics',
    description: 'Apple iPhone 16 128 GB',
    showcasePrice: 61999,
    showcaseAvailable: true,
  },
  {
    url: 'https://www.hepsiburada.com/ara?q=dyson%20gen5%20detect%20absolute',
    query: 'dyson gen5 detect absolute',
    marketplace: 'hepsiburada',
    category: 'Home Appliances',
    description: 'Dyson Gen5 Detect Absolute Cordless Vacuum',
    showcasePrice: 38999,
    showcaseAvailable: true,
  },
  {
    url: 'https://www.hepsiburada.com/ara?q=airpods%204%20active%20noise%20cancellation',
    query: 'airpods 4 active noise cancellation',
    marketplace: 'hepsiburada',
    category: 'Electronics',
    description: 'Apple AirPods 4 Active Noise Cancellation',
    showcasePrice: 10999,
    showcaseAvailable: true,
  },
  {
    url: 'https://www.hepsiburada.com/ara?q=samsung%20galaxy%20watch%207%2044mm',
    query: 'samsung galaxy watch 7 44mm',
    marketplace: 'hepsiburada',
    category: 'Wearables',
    description: 'Samsung Galaxy Watch 7 44mm',
    showcasePrice: 12999,
    showcaseAvailable: false,
  },

  // N11 Products
  {
    url: 'https://www.n11.com/arama?q=iphone%2015%20128%20gb',
    query: 'iphone 15 128 gb',
    marketplace: 'n11',
    category: 'Electronics',
    description: 'Apple iPhone 15 128 GB',
    showcasePrice: 58999,
    showcaseAvailable: true,
  },
  {
    url: 'https://www.n11.com/arama?q=samsung%20s25%20ultra',
    query: 'samsung s25 ultra',
    marketplace: 'n11',
    category: 'Electronics',
    description: 'Samsung Galaxy S25 Ultra 256 GB',
    showcasePrice: 79999,
    showcaseAvailable: true,
  },
  {
    url: 'https://www.n11.com/arama?q=dyson%20v15',
    query: 'dyson v15',
    marketplace: 'n11',
    category: 'Home Appliances',
    description: 'Dyson V15 Detect Absolute Dikey Supurge',
    showcasePrice: 34999,
    showcaseAvailable: true,
  },

  // Amazon TR Products
  {
    url: 'https://www.amazon.com.tr/s?k=playstation%20portal%20remote%20player',
    query: 'playstation portal remote player',
    marketplace: 'amazon-tr',
    category: 'Gaming',
    description: 'PlayStation Portal Remote Player',
    showcasePrice: 14999,
    showcaseAvailable: true,
  },
  {
    url: 'https://www.amazon.com.tr/s?k=logitech%20mx%20keys%20mini',
    query: 'logitech mx keys mini',
    marketplace: 'amazon-tr',
    category: 'Computers',
    description: 'Logitech MX Keys Mini',
    showcasePrice: 4999,
    showcaseAvailable: true,
  },
  {
    url: 'https://www.amazon.com.tr/s?k=logitech%20mx%20master%203s%20performance%20mouse',
    query: 'logitech mx master 3s performance mouse',
    marketplace: 'amazon-tr',
    category: 'Computers',
    description: 'Logitech MX Master 3S Performance Mouse',
    showcasePrice: 4999,
    showcaseAvailable: true,
  },
  {
    url: 'https://www.amazon.com.tr/s?k=dualsense%20edge%20controller',
    query: 'dualsense edge controller',
    marketplace: 'amazon-tr',
    category: 'Gaming',
    description: 'Sony PlayStation 5 DualSense Edge Controller',
    showcasePrice: 8999,
    showcaseAvailable: false,
  },
];

/**
 * Get seed products by marketplace
 */
export function getSeedProductsByMarketplace(
  marketplace: 'trendyol' | 'hepsiburada' | 'n11' | 'amazon-tr'
): SeedProduct[] {
  return SEED_PRODUCTS.filter(p => p.marketplace === marketplace);
}

/**
 * Get seed products by category
 */
export function getSeedProductsByCategory(category: string): SeedProduct[] {
  return SEED_PRODUCTS.filter(p => p.category === category);
}

/**
 * Get all unique categories
 */
export function getAllCategories(): string[] {
  return [...new Set(SEED_PRODUCTS.map(p => p.category))];
}
