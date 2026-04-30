---
phase: 4
plan: 2
wave: 1
---

# Plan 4.2: Payments Tab & Summary

## Objective
Implement the "Payments" tab UI to serve as a collection checklist for the organizer.

## Context
- app/(tabs)/payments.tsx
- src/database/repositories/paymentRepository.ts
- src/components/ui/index.ts

## Tasks

<task type="auto">
  <name>Build Payments Checklist UI</name>
  <files>
    app/(tabs)/payments.tsx
  </files>
  <action>
    1. Fetch active chit and current round (pending or latest).
    2. Display a summary card at the top:
       - "Total Expected" (₹ Sum)
       - "Total Collected" (₹ Sum)
       - "Pending Members" (Count)
    3. List all members for the current round using `paymentRepo.getPaymentsByRound`.
    4. Row details:
       - Member Name
       - Progress Bar or Text: `₹Paid / ₹Expected`
       - Status Badge: `Paid` (success), `Partial` (warning), `Pending` (info).
    5. Search bar to quickly find members.
    6. Tapping a member row navigates to `/record-payment?paymentId=...`.
  </action>
  <verify>
    - Screen displays accurate summary and member list.
    - Navigation to recording screen works.
  </verify>
  <done>
    - Organizer can track monthly collection progress at a glance.
  </done>
</task>

## Success Criteria
- [ ] Collection summary correctly sums up all member payments.
- [ ] All 20 members are listed with their specific monthly dues.
