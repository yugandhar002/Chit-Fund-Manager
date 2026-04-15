---
phase: 3
plan: 2
wave: 1
---

# Plan 3.2: Auction Recording UI

## Objective
Implement the "Pata" recording screen where the organizer enters the result of the monthly auction. This calculates the payout for the winner and the dividend for all members.

## Context
- .gsd/SPEC.md
- src/database/index.ts
- src/components/ui/index.ts

## Tasks

<task type="auto">
  <name>Create Auction Recording Screen</name>
  <files>
    app/record-auction.tsx
  </files>
  <action>
    1. Implement form in `app/record-auction.tsx`:
       - Winner Selection: Dropdown/Picker showing only members who haven't won an auction yet (use `MemberRepository.getAvailableBidders`).
       - Commission Amount (Pata): Numeric input (e.g., 60,000).
    2. Dynamic Calculations (UI feedback):
       - Payout to Winner: ₹(Total - Commission).
       - Dividend per Member: ₹(Commission / Member Count).
    3. Save to `auctions` table via `AuctionRepository`.
    4. On success, navigate back to Auction tab.
  </action>
  <verify>
    - Bidder list correctly excludes previous winners.
    - Calculations match the user's business logic (Commission / 20).
    - Data persists in SQLite.
  </verify>
  <done>
    - Organizer can record a monthly auction result easily.
  </done>
</task>

<task type="auto">
  <name>Update Auction Tab Entry Point</name>
  <files>
    app/(tabs)/auction.tsx
  </files>
  <action>
    1. Fetch current round from `RoundRepository`.
    2. If a round is active but has no auction record:
       - Show an "Enter Auction Result" button.
    3. If an auction record exists:
       - Show the winner name, commission, and dividend details for the month.
  </action>
  <verify>
    - Navigation to `record-auction` works.
    - Auction tab reflects the current state of the month.
  </verify>
  <done>
    - Primary entry point for auction management is functional.
  </done>
</task>

## Success Criteria
- [ ] Organizer can select a winner and record the auction amount.
- [ ] Payouts and dividends are accurately calculated and stored.
