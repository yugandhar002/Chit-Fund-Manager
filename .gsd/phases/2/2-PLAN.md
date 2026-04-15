---
phase: 2
plan: 2
wave: 1
---

# Plan 2.2: Member Management — Creation

## Objective
Implement the "Add Member" screen and link it from the main Members tab. This allows the organizer to register the 20 members (including themselves) for the chit fund.

## Context
- .gsd/SPEC.md
- src/database/index.ts
- src/components/ui/index.ts

## Tasks

<task type="auto">
  <name>Create Add Member Screen</name>
  <files>
    app/add-member.tsx
  </files>
  <action>
    1. Implement `app/add-member.tsx` with fields for:
       - Name (Text input, required)
       - Phone (Numeric input, optional)
       - Address (Text input, optional)
       - Is Organizer? (Switch/Toggle)
    2. Use `MemberRepository` to save the record to the `members` table.
    3. Validate that a member belongs to the active chit fund.
    4. On success, navigate back to the Members screen.
  </action>
  <verify>
    - Form validation prevents empty name submissions.
    - Saving successfully adds a record to the `members` table in SQLite.
  </verify>
  <done>
    - Organizer can add new members with basic details.
    - Toggle for "Is Organizer" is available and functioning.
  </done>
</task>

<task type="auto">
  <name>Update Members Tab</name>
  <files>
    app/(tabs)/members.tsx
  </files>
  <action>
    1. Update `app/(tabs)/members.tsx` to:
       - Fetch and list all members for the active chit from `MemberRepository`.
       - Replace the `EmptyState` when members exist.
       - Use the `Card` component for member entries.
       - Add a "Floating Action Button" (FAB) or Header action button to navigate to `app/add-member.tsx`.
  </action>
  <verify>
    - Member list renders correctly once members are added.
    - Button to add members navigates to the creation screen.
  </verify>
  <done>
    - All members are listed with their primary info (name/phone).
    - Clear UI path to adding new participants.
  </done>
</task>

## Success Criteria
- [ ] Member data persists correctly in SQLite.
- [ ] List updates automatically after adding a member.
