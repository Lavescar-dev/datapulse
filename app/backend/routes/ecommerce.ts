import { Hono } from 'hono';

const ecommerceRoutes = new Hono();

interface Product {
  id: string;
  name: string;
  source: string;
  category: string;
  price: number;
  currency: string;
  in_stock: boolean;
  price_history: Array<{ date: string; price: number }>;
}

const productsData: Array<[string, string, string, number, string]> = [
  ['iPhone 16 Pro Max', 'Amazon', 'Electronics', 1299, 'USD'],
  ['Samsung Galaxy S25 Ultra', 'Best Buy', 'Electronics', 1199, 'USD'],
  ['Sony WH-1000XM6', 'Amazon', 'Audio', 349, 'USD'],
  ['MacBook Air M4', 'Apple Store', 'Electronics', 1499, 'USD'],
  ['LG OLED C4 65"', 'Best Buy', 'Electronics', 1899, 'USD'],
  ['Dyson V15 Detect', 'Target', 'Home', 649, 'USD'],
  ['Nike Air Max 2026', 'Nike', 'Fashion', 180, 'USD'],
  ['PlayStation 6', 'Amazon', 'Gaming', 599, 'USD'],
  ['Apple Watch Series 10', 'Apple Store', 'Wearables', 429, 'USD'],
  ['Bose QuietComfort Ultra', 'Bose', 'Audio', 379, 'USD'],
];

function generatePriceHistory(basePrice: number): Array<{ date: string; price: number }> {
  const history: Array<{ date: string; price: number }> = [];
  const now = Date.now();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
    const price = Math.round(basePrice * (1 + variation) * 100) / 100;

    history.push({
      date: date.toISOString().split('T')[0] ?? date.toISOString(),
      price,
    });
  }

  return history;
}

function generateProducts(): Product[] {
  return productsData.map(([name, source, category, basePrice, currency], index) => {
    const priceVariation = (Math.random() - 0.5) * 0.05; // ±2.5%
    const price = Math.round(basePrice * (1 + priceVariation) * 100) / 100;

    return {
      id: `prod-${String(index + 1).padStart(3, '0')}`,
      name,
      source,
      category,
      price,
      currency,
      in_stock: Math.random() > 0.15, // 85% in stock
      price_history: generatePriceHistory(basePrice),
    };
  });
}

ecommerceRoutes.get('/products', (c) => {
  const products = generateProducts();
  return c.json({
    count: products.length,
    products,
  });
});

export { ecommerceRoutes };
