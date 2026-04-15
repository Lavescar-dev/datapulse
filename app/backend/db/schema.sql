-- Products table: stores unique products being tracked
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(query)
);

-- Price records: stores individual price scrapes from each source
CREATE TABLE IF NOT EXISTS price_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  price REAL NOT NULL,
  currency TEXT DEFAULT 'TRY',
  in_stock BOOLEAN DEFAULT 1,
  url TEXT,
  scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Price history: aggregated daily price data per source
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  date DATE NOT NULL,
  avg_price REAL NOT NULL,
  min_price REAL NOT NULL,
  max_price REAL NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(product_id, source, date)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_price_records_product_source ON price_records(product_id, source, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_product_date ON price_history(product_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_products_query ON products(query);
