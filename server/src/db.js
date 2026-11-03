import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function openDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function migrate(db) {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/001_init.sql'), 'utf8');
  db.exec(sql);
  return db;
}

export function seedPackages(db, packages) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO packages (id, name_ar, messages, minutes, price_sar, currency, margin_percent, active)
    VALUES (@id, @name_ar, @messages, @minutes, @price_sar, 'SAR', @margin_percent, 1)
  `);
  const tx = db.transaction((pkgs) => {
    for (const p of pkgs) insert.run(p);
  });
  tx(packages);
}
