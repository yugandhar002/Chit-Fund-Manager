import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'chitfund.db';

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await initializeSchema(db);
  }
  return db;
};

export const getDatabaseSync = () => {
  if (!db) {
    db = SQLite.openDatabaseSync(DATABASE_NAME);
    // Note: async init might be needed for full schema, 
    // but synchronous init is easier for repos.
    // However, expo-sqlite recommend async for heavy tasks.
  }
  return db;
};

const initializeSchema = async (database: SQLite.SQLiteDatabase) => {
  // Enable foreign keys
  await database.execAsync('PRAGMA foreign_keys = ON;');
  await database.execAsync('PRAGMA journal_mode = WAL;');

  // Schema initialization
  // We'll define the tables here. In a real app we might use migrations.
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS chits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      total_value INTEGER NOT NULL,
      member_count INTEGER NOT NULL,
      monthly_contribution INTEGER NOT NULL,
      duration_months INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chit_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      is_organizer INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (chit_id) REFERENCES chits(id)
    );

    CREATE TABLE IF NOT EXISTS monthly_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chit_id INTEGER NOT NULL,
      month_number INTEGER NOT NULL,
      round_date TEXT,
      is_organizer_month INTEGER NOT NULL DEFAULT 0,
      is_double_pata INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (chit_id) REFERENCES chits(id),
      UNIQUE(chit_id, month_number)
    );

    CREATE TABLE IF NOT EXISTS auctions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL,
      winner_member_id INTEGER NOT NULL,
      commission_amount INTEGER NOT NULL,
      payout_amount INTEGER NOT NULL,
      dividend_per_member INTEGER NOT NULL,
      effective_contribution INTEGER NOT NULL,
      auction_number INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (round_id) REFERENCES monthly_rounds(id),
      FOREIGN KEY (winner_member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      expected_amount INTEGER NOT NULL,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      payment_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id),
      UNIQUE(round_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS payment_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      payment_date TEXT NOT NULL DEFAULT (datetime('now')),
      notes TEXT,
      FOREIGN KEY (payment_id) REFERENCES payments(id)
    );
  `);
};
