CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'canceled', 'expired')),
  locale TEXT NOT NULL,
  email TEXT NOT NULL,
  customer TEXT NOT NULL,
  lines TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents > 0),
  payment TEXT UNIQUE,
  notified INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX orders_status ON orders (status, created_at);
