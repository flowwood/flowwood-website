CREATE TABLE rate_limit (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  period INTEGER NOT NULL,
  hits INTEGER NOT NULL
);

CREATE INDEX rate_limit_scope_period ON rate_limit (scope, period);
