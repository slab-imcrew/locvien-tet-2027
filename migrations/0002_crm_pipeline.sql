ALTER TABLE leads ADD COLUMN marketing_status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE leads ADD COLUMN sales_status TEXT NOT NULL DEFAULT 'unassigned';
ALTER TABLE leads ADD COLUMN assigned_to TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN handed_off_at TEXT;
ALTER TABLE leads ADD COLUMN last_activity_at TEXT;

CREATE TABLE IF NOT EXISTS lead_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  note TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id, created_at DESC);
