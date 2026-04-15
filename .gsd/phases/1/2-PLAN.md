---
phase: 1
plan: 2
wave: 1
---

# Plan 1.2: SQLite Database Schema & Migration

## Objective
Design and implement the SQLite database schema that models the entire chit fund domain — chits, members, monthly rounds (auctions), and payments. Create migration system that auto-creates tables on first app launch.

## Context
- .gsd/SPEC.md (Business Rules section)
- .gsd/DECISIONS.md (ADR-001: SQLite choice)
- package.json (expo-sqlite dependency)

## Tasks

<task type="auto">
  <name>Create database schema file</name>
  <files>
    src/database/schema.sql
    src/database/database.ts
  </files>
  <action>
    Create `src/database/schema.sql` with the following tables:

    **1. chits** — The chit fund configuration
    ```sql
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
    ```

    **2. members** — Chit fund members
    ```sql
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
    ```

    **3. monthly_rounds** — Each month's round data
    ```sql
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
    ```

    **4. auctions** — Auction results per round
    ```sql
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
    ```

    **5. payments** — Individual payment records
    ```sql
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
    ```

    Create `src/database/database.ts`:
    - Open/create SQLite database using expo-sqlite
    - Execute schema.sql on first launch (migration)
    - Export a `getDatabase()` function that returns the initialized db instance
    - Use WAL mode for better concurrent read performance
    - Store all monetary values in PAISA (integer) to avoid floating point issues
  </action>
  <verify>
    - Verify schema.sql file exists and contains all 5 CREATE TABLE statements
    - Verify database.ts exports getDatabase function
    - TypeScript compiles without errors: npx tsc --noEmit src/database/database.ts
  </verify>
  <done>
    - 5 tables defined: chits, members, monthly_rounds, auctions, payments
    - All monetary values stored in paisa (integers)
    - Foreign keys properly link all related tables
    - database.ts initializes SQLite and runs migrations
  </done>
</task>

<task type="auto">
  <name>Create data repository layer</name>
  <files>
    src/database/repositories/chitRepository.ts
    src/database/repositories/memberRepository.ts
    src/database/repositories/roundRepository.ts
    src/database/repositories/auctionRepository.ts
    src/database/repositories/paymentRepository.ts
    src/database/index.ts
  </files>
  <action>
    Create repository files with typed CRUD operations:

    **chitRepository.ts:**
    - createChit(data) → Chit
    - getActiveChit() → Chit | null
    - updateChitStatus(id, status)

    **memberRepository.ts:**
    - addMember(data) → Member
    - getMembersByChit(chitId) → Member[]
    - updateMember(id, data)
    - getAvailableBidders(chitId) → Member[] (members who haven't won yet)

    **roundRepository.ts:**
    - createRound(data) → MonthlyRound
    - getRoundsByChit(chitId) → MonthlyRound[]
    - getCurrentRound(chitId) → MonthlyRound | null
    - updateRoundStatus(id, status)

    **auctionRepository.ts:**
    - recordAuction(data) → Auction
    - getAuctionsByRound(roundId) → Auction[]
    - getAuctionHistory(chitId) → Auction[] (all auctions with member names)
    - getCumulativeCommission(chitId) → number (total commission across all months)

    **paymentRepository.ts:**
    - createPaymentEntries(roundId, members, expectedAmount) → void (bulk create for all members)
    - updatePayment(id, paidAmount, status, notes)
    - getPaymentsByRound(roundId) → Payment[]
    - getPaymentsByMember(memberId) → Payment[]
    - getPaymentSummary(roundId) → { paid: number, partial: number, pending: number }

    **index.ts:**
    - Re-export all repositories
    - Export TypeScript interfaces for all entities (Chit, Member, MonthlyRound, Auction, Payment)

    IMPORTANT: All repositories receive the db instance as a parameter (dependency injection).
    Use expo-sqlite's synchronous API (db.getAllSync, db.runSync) for simplicity.
  </action>
  <verify>
    - All 5 repository files exist
    - index.ts re-exports all repositories and types
    - TypeScript compiles without errors
  </verify>
  <done>
    - Complete CRUD repository for each entity
    - TypeScript interfaces defined for all 5 entities
    - All monetary values handled in paisa throughout
    - getAvailableBidders correctly filters out past winners
    - getCumulativeCommission sums all auction commissions
  </done>
</task>

## Success Criteria
- [ ] Schema defines 5 tables with proper foreign keys and constraints
- [ ] All monetary values stored as integers (paisa)
- [ ] Repository layer provides typed CRUD for all entities
- [ ] getCumulativeCommission enables double-pata detection logic
- [ ] TypeScript compiles without errors
