---
phase: 7
plan: 1
wave: 1
---

# Plan 7.1: Multi-Chit Infrastructure

## Objective
Establish the foundation for managing multiple chits by adding database queries and global state management.

## Context
- .gsd/SPEC.md
- src/database/repositories/chitRepository.ts
- app/(tabs)/_layout.tsx

## Tasks

<task type="auto">
  <name>Update ChitRepository</name>
  <files>src/database/repositories/chitRepository.ts</files>
  <action>
    Add a method `getAllChits()` that returns a list of all chits ordered by creation date.
  </action>
  <verify>Check file for getAllChits implementation.</verify>
  <done>Method exists and returns `Promise<Chit[]>`.</done>
</task>

<task type="auto">
  <name>Create ChitContext</name>
  <files>src/context/ChitContext.tsx</files>
  <action>
    - Create a React Context that stores `selectedChitId` (number | null).
    - Use `AsyncStorage` to persist the selected ID across app restarts.
    - Provide `setSelectedChitId` function.
    - On first launch (if no ID persisted), use `getActiveChit()` to pick the latest one as default.
  </action>
  <verify>Verify file creation and use of AsyncStorage.</verify>
  <done>Context exists and handles persistence.</done>
</task>

<task type="auto">
  <name>Wrap App with Provider</name>
  <files>app/(tabs)/_layout.tsx</files>
  <action>
    Import `ChitProvider` and wrap the `Tabs` layout with it.
  </action>
  <verify>Verify _layout.tsx includes the provider.</verify>
  <done>Context is available across all tabs.</done>
</task>

## Success Criteria
- [ ] Database supports listing all chits.
- [ ] Global state for selected chit is functional and persisted.
