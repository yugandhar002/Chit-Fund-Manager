---
phase: 7
plan: 2
wave: 1
---

# Plan 7.2: Multi-Chit UI Implementation

## Objective
Provide the user interface to switch between chits and create new ones.

## Context
- src/context/ChitContext.tsx
- app/(tabs)/index.tsx
- app/create-chit.tsx

## Tasks

<task type="auto">
  <name>Create ChitSwitcher Component</name>
  <files>src/components/ChitSwitcher.tsx</files>
  <action>
    - Build a modal-based or dropdown component that lists all chits.
    - Show current chit name and a "Switch" button.
    - Highlight the currently selected chit.
  </action>
  <verify>Verify component creation.</verify>
  <done>Switcher component is functional.</done>
</task>

<task type="auto">
  <name>Update Dashboard UI</name>
  <files>app/(tabs)/index.tsx</files>
  <action>
    - Add the `ChitSwitcher` to the top of the Home dashboard.
    - Change "Create Chit" logic: instead of only showing it when no chit exists, add an "Add New Fund" button in the switcher or header.
  </action>
  <verify>Check dashboard for switcher and new fund button.</verify>
  <done>Dashboard allows switching and starting new funds.</done>
</task>

<task type="auto">
  <name>Refine Create Chit flow</name>
  <files>app/create-chit.tsx</files>
  <action>
    Ensure that after creating a new chit, it automatically sets the `selectedChitId` to the new ID and navigates to the dashboard.
  </action>
  <verify>Verify navigation and context update on success.</verify>
  <done>New chits are automatically selected upon creation.</done>
</task>

## Success Criteria
- [ ] User can see a list of all their chits.
- [ ] User can switch between chits and see the UI update.
- [ ] User can start a new chit fund at any time.
