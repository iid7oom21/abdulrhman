-- Local simulator only; no financial gateway or authenticated account is implemented.
CREATE TABLE IF NOT EXISTS simulation_quotes (
  payment_id TEXT PRIMARY KEY REFERENCES payments(id),
  messages INTEGER NOT NULL CHECK(messages > 0)
);
CREATE TABLE IF NOT EXISTS simulation_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  fingerprint TEXT NOT NULL,
  response_json TEXT NOT NULL
);
