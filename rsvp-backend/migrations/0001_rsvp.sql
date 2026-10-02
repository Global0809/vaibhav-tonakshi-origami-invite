CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  attendance TEXT NOT NULL CHECK (attendance IN ('Joyfully accepting', 'Regretfully declining')),
  days TEXT NOT NULL,
  additional_guests INTEGER NOT NULL DEFAULT 0 CHECK (additional_guests BETWEEN 0 AND 8),
  guest_names TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS rsvps_created_at ON rsvps(created_at DESC);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS rate_limits_expiration ON rate_limits(expires_at);
