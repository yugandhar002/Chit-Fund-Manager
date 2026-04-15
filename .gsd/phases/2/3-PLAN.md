---
phase: 2
plan: 3
wave: 2
---

# Plan 2.3: Member Details & Progress

## Objective
Provide a detailed view for individual members, allowing for editing and deletion. Track the progress of adding all 20 members on the Dashboard.

## Context
- .gsd/SPEC.md
- src/database/index.ts
- src/components/ui/index.ts

## Tasks

<task type="auto">
  <name>Create Member Detail & Edit Screen</name>
  <files>
    app/member-detail.tsx
  </files>
  <action>
    1. Implement detailed view for a member:
       - Displays full name, phone, address, and status.
       - Allows editing all fields (name/phone/address).
       - Includes a "Delete" button (with a confirmation modal) to remove a member.
    2. Link this screen from the Members list (tapping a card).
    3. Update `MemberRepository` with an `updateMember` and `deleteMember` method.
  </action>
  <verify>
    - Tapping a member card navigates to their details.
    - Edits persist in SQLite.
    - Deletion correctly removes the member from the list.
  </verify>
  <done>
    - Member lifecycle management (Edit/Delete) is fully functional.
    - Navigation between list and details is smooth.
  </done>
</task>

<task type="auto">
  <name>Dashboard Progress Tracker</name>
  <files>
    app/(tabs)/index.tsx
  </files>
  <action>
    Update the Dashboard's "Members" StatCard to show current count vs required count (e.g., `8 / 20`).
    Also, if all 20 members aren't added yet, show a reminder message or progress bar.
  </action>
  <verify>
    - Dashboard correctly reflects the number of members currently added.
    - UI updates in real-time (or on navigation back from addition).
  </verify>
  <done>
    - Dashboard clearly tracks the state of the chit setup.
  </done>
</task>

## Success Criteria
- [ ] Organizer has total control over member entries.
- [ ] App provides a clear visual indicator of the chit's setup progress.
