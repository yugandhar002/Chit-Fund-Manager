# ROADMAP.md

> **Current Phase**: Not started
> **Milestone**: v1.0

## Must-Haves (from SPEC)
- [ ] Chit creation with configurable value, members, and duration
- [ ] Member management (add, edit, view 20 members)
- [ ] Monthly auction recording with auto-calculated payouts & dividends
- [ ] Payment tracking (paid/partial/pending) per member per month
- [ ] Dashboard with at-a-glance chit status
- [ ] Organizer's first month handling (no auction)
- [ ] Double-pata month detection
- [ ] Offline-first local SQLite storage

## Phases

### Phase 1: Foundation & Data Layer
**Status**: ✅ Complete
**Objective**: Set up Expo project, design and implement the SQLite database schema, and create the data access layer (repositories) for all core entities — chits, members, months, auctions, and payments.
**Deliverables**:
- Expo project initialized with required dependencies
- SQLite database with schema for all tables
- Repository/service layer for CRUD operations
- Basic navigation shell (tab navigator)

### Phase 2: Member Management & Chit Setup
**Status**: ✅ Complete
**Objective**: Build the UI for creating a new chit fund and managing members — add/edit/remove members, view member list, and set up the chit parameters (value, duration, monthly amount).
**Deliverables**:
- Create Chit screen (set value, members count, duration)
- Add/Edit Member screen
- Member list with search
- Chit configuration persisted to SQLite

### Phase 3: Auction & Commission Engine
**Status**: ✅ Complete
**Objective**: Build the monthly auction recording system — enter auction results, auto-calculate winner payout, commission split, per-member dividend, and track which members have won. Handle organizer's first month and double-pata detection.
**Deliverables**:
- Monthly auction entry screen
- Auto-calculation of payout, commission, dividend
- Winner history tracking
- Organizer's month 1 auto-handling
- Double-pata month detection and handling

### Phase 4: Payment Collection & Tracking
**Status**: ✅ Complete
**Objective**: Build the payment recording system — mark daily/monthly payments from each member, track partial payments, flag late/pending payments, and show payment history per member.
**Deliverables**:
- Payment entry screen (per member per month)
- Partial payment support
- Payment status indicators (paid/partial/pending/late)
- Member payment history view
- Monthly collection summary

### Phase 5: Dashboard & Reports
**Status**: ✅ Complete
**Objective**: Build the home dashboard with at-a-glance chit status, monthly summaries, member completion tracking, and financial reports.
**Deliverables**:
- Home dashboard with chit progress overview
- Monthly summary cards (collection, commission, pending)
- Member completion status (who finished, who's remaining)
- Commission history across all months
- Overall financial summary

### Phase 6: Multi-Pata Management
**Status**: ✅ Complete
**Objective**: Enable recording and managing multiple auctions in a single month (N-patas) with adjusted financial tracking.
**Deliverables**:
- Multi-auction recording UI
- Cumulative dividend adjustment logic
- Dashboard "Patas Available" indicator
- Grouped auction history in Reports

### Phase 7: Multi-Chit Management (Deferred)
**Status**: ⬜ Deferred
**Objective**: Enable managing multiple chit funds simultaneously. (Reverted in favor of single-chit focus).

### Phase 8: Recently Interacted Sorting in Payments
**Status**: ✅ Complete
**Objective**: Sort the member payments list by the most recently interacted/recorded transactions so that recently active entries appear at the top.
**Deliverables**:
- [x] Explicitly update `updated_at` in `PaymentRepository` when adding, editing, or deleting payment transactions.
- [x] Sort payments returned by `getPaymentsByRound` by `updated_at` descending.

