---
phase: 5
plan: 3
wave: 2
---

# Plan 5.3: Reports & Settlement Tab

## Objective
Implement a dedicated tab for detailed financial reports and member settlement status.

## Context
- app/(tabs)/_layout.tsx
- app/(tabs)/reports.tsx [NEW]
- src/database/repositories/auctionRepository.ts

## Tasks

<task type="auto">
  <name>Create Reports Tab and Layout</name>
  <files>
    app/(tabs)/_layout.tsx
    app/(tabs)/reports.tsx
  </files>
  <action>
    1. Create `app/(tabs)/reports.tsx`.
    2. Add the tab to `app/(tabs)/_layout.tsx` with a `bar-chart-outline` icon.
    3. UI Sections in Reports:
       - **Member Settlement List**: Shows all 20 members and whether they have won their pot (`Won` vs `Pending`).
       - **Commission History**: List of all concluded months and the commission earned in each.
       - **Outstanding Dues**: List of members who have any pending dues across any month.
  </action>
  <verify>
    - New tab is visible and functional.
    - Data is correctly loaded and categorized in reports.
  </verify>
  <done>
    - Detailed reporting and settlement tracking is available.
  </done>
</task>

## Success Criteria
- [ ] Organizer can see exactly who has not yet won an auction.
- [ ] Organizer can see a list of all members with overdue payments.
- [ ] Monthly commission log is visible.
