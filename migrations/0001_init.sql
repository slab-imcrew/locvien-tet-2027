CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT NOT NULL,
  quantity TEXT,
  budget TEXT,
  custom_need TEXT,
  note TEXT,
  payment_description TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 100000,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
