---
phase: 8
plan: 1
wave: 1
gap_closure: false
---

# Plan 8.1: Recently Interacted Sorting in Payments

## Objective
Sort the member payments list by the most recently interacted/recorded transactions so that recently active entries appear at the top.

## Context
Load these files for context:
- .gsd/SPEC.md
- src/database/repositories/paymentRepository.ts

## Tasks

<task type="auto">
  <name>Explicitly update updated_at on payments changes</name>
  <files>
    src/database/repositories/paymentRepository.ts
  </files>
  <action>
    Modify `src/database/repositories/paymentRepository.ts` to update the `updated_at` timestamp:
    1. In `createPaymentEntries`, set `created_at` and `updated_at` to `new Date().toISOString()`.
    2. In `updatePayment`, add `updated_at: new Date().toISOString()` to the `updateData` payload.
    3. In `markAsRefunded`, add `updated_at: new Date().toISOString()` to the update payload.
  </action>
  <verify>
    Ensure compiling checks pass.
  </verify>
  <done>
    `updated_at` column is updated every time a payment status or amount is modified.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Recording a payment moves that member to the top of the payments list.
- [ ] Modifying or deleting a payment transaction keeps or moves that member to the top of the payments list.

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
