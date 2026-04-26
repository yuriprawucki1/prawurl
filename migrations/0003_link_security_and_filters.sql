PRAGMA foreign_keys = ON;

ALTER TABLE links ADD COLUMN destination_domain TEXT NOT NULL DEFAULT '';
ALTER TABLE links ADD COLUMN password_hash TEXT;
ALTER TABLE links ADD COLUMN password_salt TEXT;
ALTER TABLE links ADD COLUMN password_iterations INTEGER;
ALTER TABLE links ADD COLUMN password_updated_at TEXT;
ALTER TABLE links ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE links ADD COLUMN click_limit INTEGER;
ALTER TABLE links ADD COLUMN inactive_expires_after_minutes INTEGER;
ALTER TABLE links ADD COLUMN last_clicked_at TEXT;
ALTER TABLE links ADD COLUMN country_allowlist_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE links ADD COLUMN country_blocklist_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE links ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE links ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE links ADD COLUMN safety_status TEXT NOT NULL DEFAULT 'clean';
ALTER TABLE links ADD COLUMN safety_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_links_destination_domain ON links(destination_domain);
CREATE INDEX IF NOT EXISTS idx_links_status ON links(status);
CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at);
