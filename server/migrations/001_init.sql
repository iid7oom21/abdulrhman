-- Migration 001: Initial schema for AI dialogue credits (simulation)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  messages INTEGER NOT NULL,
  minutes INTEGER,
  price_sar INTEGER NOT NULL,
  currency TEXT DEFAULT 'SAR',
  margin_percent INTEGER DEFAULT 30,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_credits (
  user_id TEXT PRIMARY KEY,
  balance_messages INTEGER DEFAULT 0,
  balance_minutes INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  gateway_ref TEXT,
  signature_verified INTEGER DEFAULT 0,
  idempotency_key TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (package_id) REFERENCES packages(id)
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  delta_messages INTEGER,
  delta_minutes INTEGER,
  reason TEXT,
  related_payment_id TEXT,
  related_session_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dialogue_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  mode TEXT DEFAULT 'written',
  messages_used INTEGER DEFAULT 0,
  max_messages INTEGER DEFAULT 20,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS case_progress (
  user_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  stage TEXT DEFAULT 'intro',
  evidence_found TEXT DEFAULT '[]',
  accusation TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, case_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_case ON dialogue_sessions(user_id, case_id);
