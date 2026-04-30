---
phase: 5
plan: 1
wave: 1
---

# Plan 5.1: Financial Repositories & Service Logic

## Objective
Implement the data aggregation logic needed for the final dashboard and reports. This includes calculating total commission, outstanding dues, and member payout status.

## Context
- .gsd/SPEC.md
- src/database/repositories/auctionRepository.ts
- src/database/repositories/paymentRepository.ts
- src/services/chitService.ts

## Tasks

<task type="auto">
  <name>Extend Repositories with Summary Methods</name>
  <files>
    src/database/repositories/auctionRepository.ts
    src/database/repositories/paymentRepository.ts
  </files>
  <action>
    1. In `AuctionRepository`: Add `getTotalCommission(chitId: number)` and `getWinners(chitId: number)` (list of member IDs who won).
    2. In `PaymentRepository`: Add `getOverallOutstandingDues(chitId: number)` which sums up `expected_amount - paid_amount` across all rounds.
    3. In `PaymentRepository`: Add `getTotalCollected(chitId: number)` summing up all `paid_amount`.
  </action>
  <verify>
    - New methods return correct aggregate data from the database.
  </verify>
  <done>
    - Repositories provide the necessary financial data for reporting.
  </done>
</task>

<task type="auto">
  <name>Implement getFinancialSummary in ChitService</name>
  <files>
    src/services/chitService.ts
  </files>
  <action>
    1. Add `getFinancialSummary(chitId: number)` to `ChitService`.
    2. It should return:
       - totalCommission: Sum of all auction commissions.
       - totalCollected: Sum of all payments.
       - totalOutstanding: Total dues remaining.
       - progress: Current month / Total duration.
       - winnerCount: How many members have won an auction.
  </action>
  <verify>
    - Service returns a comprehensive summary object for the dashboard.
  </verify>
  <done>
    - Backend logic for the dashboard is complete.
  </done>
</task>

## Success Criteria
- [ ] Financial data is correctly aggregated across all rounds.
- [ ] Member payout/winner status is easily accessible.
