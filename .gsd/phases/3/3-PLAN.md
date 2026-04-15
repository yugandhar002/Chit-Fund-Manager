---
phase: 3
plan: 3
wave: 2
---

# Plan 3.3: Round Management & History

## Objective
Enable the full lifecycle of the chit fund by allowing the organizer to conclude a month and transition to the next one. Maintain a clear history of all past winners.

## Context
- .gsd/SPEC.md
- src/database/index.ts
- app/(tabs)/auction.tsx

## Tasks

<task type="auto">
  <name>Implement Round Transition Logic</name>
  <files>
    src/services/chitService.ts
  </files>
  <action>
    1. Add `concludeCurrentRound(roundId: number)` to `chitService.ts`:
       - Marks the current round as 'completed'.
    2. Add `startNextRound(chitId: number)` to `chitService.ts`:
       - Fetches the last completed round number.
       - Creates a new pending `monthly_rounds` for the next month.
       - Ensures the total count doesn't exceed the chit duration (e.g., 20 months).
  </action>
  <verify>
    - Service correctly transitions between months.
    - Status changes reflect correctly in the database.
  </verify>
  <done>
    - Monthly cycle can be continued until the chit's end.
  </done>
</task>

<task type="auto">
  <name>Auction History List</name>
  <files>
    app/(tabs)/auction.tsx
  </files>
  <action>
    1. Update the Auction tab UI to show a "History" section.
    2. Use `AuctionRepository.getAuctionHistory` to list all completed auctions.
    3. Display: Month #, Winner Name, Commission, and Date.
    4. Implement buttons for "Conclude Month" and "Start Next Month" based on current state.
  </action>
  <verify>
    - History list displays all past winners correctly.
    - Buttons appear/disappear according to the round's state.
  </verify>
  <done>
    - Organizer has a complete audit trail of the chit's progress.
    - Workflow for moving between months is clear.
  </done>
</task>

## Success Criteria
- [ ] Organizer can transition the app from Month 1 to Month 2 and beyond.
- [ ] Auction history is easily accessible and historically accurate.
