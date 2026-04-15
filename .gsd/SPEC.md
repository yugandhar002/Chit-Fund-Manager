# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
A mobile application (Android & iOS) for chit fund organizers to digitally manage their entire chit fund operation — replacing paper books with an intelligent system that tracks member contributions, auction results, commission distribution, payment status, and provides a clear financial overview of each chit cycle.

## Goals
1. **Digital Member Management** — Add/manage 20 members per chit with their details and payment history
2. **Monthly Auction (Pata) Tracking** — Record auction results, calculate winner payouts, and distribute commission/dividend across all members
3. **Payment Collection Tracking** — Track daily/monthly payments from each member including partial payments, late payments, and pending dues
4. **Commission & Dividend Calculation** — Auto-calculate commission split per member each month, track cumulative commission, and handle double-pata months
5. **Financial Overview & Reports** — Dashboard showing chit progress, who has paid, who owes, monthly summaries, and completion status

## Non-Goals (Out of Scope)
- Online payment integration (UPI/bank transfers) — payments are tracked manually
- WhatsApp bot integration for auctions — auctions happen on WhatsApp, results entered in app
- Multi-organizer support — single organizer (the user) manages everything
- Member-facing portal — this is an organizer-only tool
- Running multiple simultaneous chits (v1 supports one chit at a time)

## Chit Fund Business Rules

### Structure
- **Chit Value**: ₹6,00,000
- **Members**: 20
- **Monthly Contribution**: ₹30,000 per member
- **Duration**: 20 months (1 month per member)

### Month 1 — Organizer's Month
- No auction (pata) occurs
- Organizer (user) takes the entire pot (₹6,00,000)
- All members pay full ₹30,000

### Month 2–20 — Auction Months
- Auction (pata) happens on WhatsApp group
- Highest bidder wins (bids the commission amount they're willing to give up)
- **Example**: Commission bid = ₹60,000
  - Winner receives: ₹6,00,000 − ₹60,000 = ₹5,40,000
  - Dividend per member: ₹60,000 ÷ 20 = ₹3,000
  - Each member's payment for that month: ₹30,000 − ₹3,000 = ₹27,000
- Winner cannot bid in future months

### Double Pata Month
- When cumulative commission collected across all months reaches ₹6,00,000, an additional pot is available
- In that month, 2 members can win the auction (2 separate auctions)

### Payment Flexibility
- Members and amounts can be flexible (substitutions possible)
- Partial payments are common and must be tracked
- Late payments need to be flagged

## Users
**Primary User**: The chit fund organizer (the developer themselves) who runs the chit in their locality. They need a single app on their phone to replace multiple paper books for tracking 20 members across 20 months.

## Constraints
- **Platform**: React Native with Expo (cross-platform Android & iOS)
- **Storage**: Local database (SQLite via expo-sqlite) — no cloud backend needed
- **Language**: English UI with Indian Rupee (₹) formatting
- **Offline-first**: Must work without internet connectivity
- **Single device**: No sync between devices needed for v1

## Success Criteria
- [ ] Organizer can create a chit with 20 members and ₹6,00,000 value
- [ ] Organizer can record monthly auction results and app auto-calculates payouts and dividends
- [ ] Organizer can mark payments as paid/partial/pending for each member each month
- [ ] Dashboard shows at-a-glance status of the entire chit (who paid, who owes, monthly progress)
- [ ] App correctly handles the organizer's first month (no auction)
- [ ] App detects and handles double-pata months based on cumulative commission
- [ ] All data persists locally and works offline
