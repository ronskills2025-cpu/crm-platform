/**
 * SQLite Database Connection (Development Only)
 * 
 * Provides a lightweight database option for development and testing
 * without requiring external database setup.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { createLogger } from '../../utils/src/logger';

const log = createLogger('db:sqlite');

let db: Database.Database | null = null;

export function connectSQLite(dbPath?: string): Database.Database {
  if (db) return db;
  
  const defaultPath = dbPath || path.join(process.cwd(), 'data', 'crm.db');
  
  // Ensure data directory exists
  const dataDir = path.dirname(defaultPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  try {
    db = new Database(defaultPath);
    
    // Enable WAL mode for better concurrency
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA cache_size = 1000000;');
    db.exec('PRAGMA foreign_keys = true;');
    db.exec('PRAGMA temp_store = memory;');
    
    log.info(`SQLite connected: ${defaultPath}`);
    return db;
    
  } catch (error) {
    log.error('SQLite connection failed', { error: error.message });
    throw error;
  }
}

export function closeSQLite(): void {
  if (db) {
    db.close();
    db = null;
    log.info('SQLite connection closed');
  }
}

// PostgreSQL-compatible query interface for SQLite
export function createSQLiteAdapter(database: Database.Database) {
  return {
    query: (text: string, params: any[] = []) => {
      try {
        // Convert PostgreSQL-style queries to SQLite
        let sqliteQuery = text
          .replace(/\$(\d+)/g, '?')  // Convert $1, $2, etc. to ?
          .replace(/RETURNING \*/g, '')  // Remove RETURNING clauses
          .replace(/ON CONFLICT.*DO NOTHING/g, 'OR IGNORE')  // Convert UPSERT syntax
          .replace(/TIMESTAMPTZ/g, 'DATETIME')  // Convert timestamp types
          .replace(/UUID/g, 'TEXT')  // Convert UUID to TEXT
          .replace(/JSONB/g, 'TEXT')  // Convert JSONB to TEXT
          .replace(/gen_random_uuid\(\)/g, "lower(hex(randomblob(16)))"); // UUID generation
        
        // Handle SELECT queries
        if (sqliteQuery.trim().toUpperCase().startsWith('SELECT')) {
          const stmt = database.prepare(sqliteQuery);
          const rows = stmt.all(...params);
          return { rows, rowCount: rows.length };
        }
        
        // Handle INSERT/UPDATE/DELETE queries
        const stmt = database.prepare(sqliteQuery);
        const result = stmt.run(...params);
        
        return {
          rows: [],
          rowCount: result.changes,
          insertId: result.lastInsertRowid
        };
        
      } catch (error) {
        log.error('SQLite query failed', { query: text, error: error.message });
        throw error;
      }
    },
    
    end: () => closeSQLite()
  };
}

export { db as sqliteDb };
