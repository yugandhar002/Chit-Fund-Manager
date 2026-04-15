---
phase: 3
plan: 1
wave: 1
---

# Plan 3.1: First Month Initialization

## Objective
Enable the transition from "Setup" to "Active" by initializing the first month. In Chit Funds, the first month's total collection usually goes to the organizer without an auction.

## Context
- .gsd/SPEC.md
- src/database/index.ts
- app/(tabs)/index.tsx

## Tasks

<task type="auto">
  <name>Implement Start First Month Logic</name>
  <files>
    src/services/chitService.ts
  </files>
  <action>
    1. Create a service method `startChitFund(chitId: number)` that:
       - Checks if the chit has 20 members.
       - Creates the first `monthly_rounds` (Month 1, is_organizer_month = 1).
       - Record the first `auctions` entry:
         - Winner: The organizer.
         - Commission: 0.
         - Payout: Total Value of chit (e.g., 6,00,000).
         - Dividend: 0.
         - Effective Contribution: Standard monthly amount (e.g., 30,000).
    2. Ensure this runs within a transaction if possible, or handle failures gracefully.
  </action>
  <verify>
    - Service correctly creates one round and one auction record for the organizer.
  </verify>
  <done>
    - The first month is formally recorded in the database.
  </done>
</task>

<task type="auto">
  <name>Dashboard "Start Fund" Integration</name>
  <files>
    app/(tabs)/index.tsx
  </files>
  <action>
    1. On the Dashboard, if 20 members are registered but no rounds exist:
       - Show a "Start Month 1" button in the Setup Status card.
    2. Tapping the button calls `chitService.startChitFund`.
    3. Refresh the Dashboard on success.
  </action>
  <verify>
    - Button appears only when 20 members are present.
    - Tapping button transitions the app to "Active" status (Month 1 shown).
  </verify>
  <done>
    - Organizer can officially start the chit cycle.
  </done>
</task>

## Success Criteria
- [ ] Round 1 is initialized with the organizer as the default winner.
- [ ] Application state correctly transitions to tracking the first month.
