---
phase: 2
plan: 1
wave: 1
---

# Plan 2.1: Chit Creation Flow

## Objective
Create the initial setup screen for a new chit fund. This allows the organizer to define the chit's name, total value, duration, and start date.

## Context
- .gsd/SPEC.md
- src/database/index.ts
- src/components/ui/index.ts

## Tasks

<task type="auto">
  <name>Create Chit Setup Screen</name>
  <files>
    app/create-chit.tsx
  </files>
  <action>
    1. Implement a form in `app/create-chit.tsx` with inputs for:
       - Chit Name (e.g., "April 2026 Batch")
       - Total Value (Number input, e.g., 600000)
       - Member Count (Default 20)
       - Duration in Months (Default 20)
       - Monthly Contribution (Auto-calculate from total/members)
       - Start Date (Date picker)
    2. Use `ChitRepository` to save the new chit to the database.
    3. On success, navigate back to the Dashboard.
    4. Implement input validation (all fields required, positive numbers).
  </action>
  <verify>
    - Component renders without errors.
    - Form validation prevents empty submissions.
    - Saving successfully adds a record to the `chits` table (check via manual verification or mock test).
  </verify>
  <done>
    - Organizer can create a new chit and it persists in SQLite.
    - User is redirected back to the Dashboard after creation.
  </done>
</task>

<task type="auto">
  <name>Dashboard "Create" Redirection</name>
  <files>
    app/(tabs)/index.tsx
  </files>
  <action>
    Update the `onAction` of the `EmptyState` component on the Dashboard to navigate to the `create-chit` screen.
  </action>
  <verify>
    - Tapping "Create New Chit" on the empty Dashboard navigates to the setup screen.
  </verify>
  <done>
    - Navigation flow from empty state to creation is working.
  </done>
</task>

## Success Criteria
- [ ] Organizer can successfully create a new chit record in the database.
- [ ] UI provides clear feedback during and after creation.
