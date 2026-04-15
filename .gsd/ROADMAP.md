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
**Status**: ⬜ Not Started
**Objective**: Build the monthly auction recording system — enter auction results, auto-calculate winner payout, commission split, per-member dividend, and track which members have won. Handle organizer's first month and double-pata detection.
**Deliverables**:
- Monthly auction entry screen
- Auto-calculation of payout, commission, dividend
- Winner history tracking
- Organizer's month 1 auto-handling
- Double-pata month detection and handling

### Phase 4: Payment Collection & Tracking
**Status**: ⬜ Not Started
**Objective**: Build the payment recording system — mark daily/monthly payments from each member, track partial payments, flag late/pending payments, and show payment history per member.
**Deliverables**:
- Payment entry screen (per member per month)
- Partial payment support
- Payment status indicators (paid/partial/pending/late)
- Member payment history view
- Monthly collection summary

### Phase 5: Dashboard & Reports
**Status**: ⬜ Not Started
**Objective**: Build the home dashboard with at-a-glance chit status, monthly summaries, member completion tracking, and financial reports.
**Deliverables**:
- Home dashboard with chit progress overview
- Monthly summary cards (collection, commission, pending)
- Member completion status (who finished, who's remaining)
- Commission history across all months
- Overall financial summary
