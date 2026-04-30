---
phase: 7
plan: 3
wave: 2
---

# Plan 7.3: Global Data Filtering

## Objective
Update all screens to respect the selected chit ID, ensuring that data is correctly siloed.

## Context
- app/(tabs)/members.tsx
- app/(tabs)/auction.tsx
- app/(tabs)/payments.tsx
- app/(tabs)/reports.tsx

## Tasks

<task type="auto">
  <name>Migrate Tab Screens</name>
  <files>
    app/(tabs)/members.tsx
    app/(tabs)/auction.tsx
    app/(tabs)/payments.tsx
    app/(tabs)/reports.tsx
  </files>
  <action>
    - Replace `chitRepo.getActiveChit()` with `useChit()` context to get `selectedChitId`.
    - Fetch data specifically for `selectedChitId`.
    - Add empty states if no chit is selected.
  </action>
  <verify>Check files for context usage and filtered queries.</verify>
  <done>All tabs filter data by the selected chit.</done>
</task>

<task type="auto">
  <name>Migrate Modal Screens</name>
  <files>
    app/add-member.tsx
    app/record-auction.tsx
    app/record-payment.tsx
  </files>
  <action>
    - Ensure these screens also use the `selectedChitId` from context to perform actions on the correct fund.
  </action>
  <verify>Check files for context usage.</verify>
  <done>Action screens are chit-aware.</done>
</task>

## Success Criteria
- [ ] Switching a chit updates all screens immediately.
- [ ] No data leakage between different chit funds.
