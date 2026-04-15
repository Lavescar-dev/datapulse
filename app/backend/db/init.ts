import { Database } from 'bun:sqlite';
import { readFileSync } from 'fs';
import { join } from 'path';

const DB_PATH = join(__dirname, 'ecommerce.db');

let db: Database | null = null;

/**
 * Initialize SQLite database with schema
 */
export function initDatabase(): Database {
  if (db) return db;

  db = new Database(DB_PATH);

  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON');

  // Read and execute schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  console.log('✓ SQLite database initialized');

  return db;
}

/**
 * Get database instance
 */
export function getDatabase(): Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('✓ Database connection closed');
  }
}

// Initialize on module load
initDatabase();
