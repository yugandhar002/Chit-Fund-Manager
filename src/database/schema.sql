-- 1. chits — The chit fund configuration
CREATE TABLE IF NOT EXISTS chits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  total_value INTEGER NOT NULL,          -- in paisa (₹6,00,000 = 60000000)
  member_count INTEGER NOT NULL,          -- 20
  monthly_contribution INTEGER NOT NULL,  -- in paisa (₹30,000 = 3000000)
  duration_months INTEGER NOT NULL,       -- 20
  start_date TEXT NOT NULL,               -- ISO date
  status TEXT NOT NULL DEFAULT 'active',  -- active, completed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. members — Chit fund members
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chit_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  is_organizer INTEGER NOT NULL DEFAULT 0,  -- 1 if this is the organizer
  status TEXT NOT NULL DEFAULT 'active',     -- active, withdrawn
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (chit_id) REFERENCES chits(id)
);

-- 3. monthly_rounds — Each month's round data
CREATE TABLE IF NOT EXISTS monthly_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chit_id INTEGER NOT NULL,
  month_number INTEGER NOT NULL,           -- 1 to 20
  round_date TEXT,                         -- When the auction happened
  is_organizer_month INTEGER NOT NULL DEFAULT 0,  -- month 1 = organizer takes
  is_double_pata INTEGER NOT NULL DEFAULT 0,       -- double auction month
  status TEXT NOT NULL DEFAULT 'pending',          -- pending, completed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (chit_id) REFERENCES chits(id),
  UNIQUE(chit_id, month_number)
);

-- 4. auctions — Auction results per round
CREATE TABLE IF NOT EXISTS auctions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  winner_member_id INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,        -- in paisa (total commission bid)
  payout_amount INTEGER NOT NULL,            -- in paisa (total_value - commission)
  dividend_per_member INTEGER NOT NULL,       -- in paisa (commission / member_count)
  effective_contribution INTEGER NOT NULL,    -- in paisa (monthly - dividend)
  auction_number INTEGER NOT NULL DEFAULT 1, -- 1 or 2 (for double pata)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (round_id) REFERENCES monthly_rounds(id),
  FOREIGN KEY (winner_member_id) REFERENCES members(id)
);

-- 5. payments — Individual payment records
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  expected_amount INTEGER NOT NULL,           -- in paisa (what they should pay)
  paid_amount INTEGER NOT NULL DEFAULT 0,     -- in paisa (what they actually paid)
  payment_date TEXT,                           -- when they paid
  status TEXT NOT NULL DEFAULT 'pending',      -- pending, partial, paid, late
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (round_id) REFERENCES monthly_rounds(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  UNIQUE(round_id, member_id)
);
