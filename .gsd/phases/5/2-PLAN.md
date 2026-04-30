---
phase: 5
plan: 2
wave: 1
---

# Plan 5.2: Home Dashboard Implementation

## Objective
Finalize the main Dashboard with real-time financial tracking and progress visualization.

## Context
- app/(tabs)/index.tsx
- src/services/chitService.ts
- src/components/ui/index.ts

## Tasks

<task type="auto">
  <name>Update Dashboard UI with Real Data</name>
  <files>
    app/(tabs)/index.tsx
  </files>
  <action>
    1. Integrate `chitService.getFinancialSummary` into the data loading flow.
    2. Update StatCards:
       - "Total Collected" should show real sum from DB.
       - Add or update cards for "Organizer Commission" and "Outstanding Dues".
    3. Add a progress bar or visual indicator of fund completion (e.g., "Month 4 of 20").
    4. Display a "Next Action" hint (e.g., "Record Month 5 Auction" or "Collect Pending Dues").
  </action>
  <verify>
    - Dashboard shows accurate financial totals and progress.
    - Setup mode still works for new chits.
  </verify>
  <done>
    - Organizer has a clear bird's-eye view of the fund's health.
  </done>
</task>

## Success Criteria
- [ ] Dashboard reflects real financial state.
- [ ] Fund progress is visually clear.
