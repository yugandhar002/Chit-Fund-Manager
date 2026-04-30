---
phase: 4
plan: 3
wave: 2
---

# Plan 4.3: Payment Entry & Member Detail Update

## Objective
Enable the organizer to record payments and view a member's full history of contributions.

## Context
- app/record-payment.tsx
- app/member-detail.tsx
- src/database/repositories/paymentRepository.ts

## Tasks

<task type="auto">
  <name>Create Record Payment Screen</name>
  <files>
    app/record-payment.tsx
  </files>
  <action>
    1. Create `app/record-payment.tsx` using `useLocalSearchParams` for `paymentId`.
    2. Fetch payment, member, and round details.
    3. UI Components:
       - Header: "Month {N} Payment for {MemberName}"
       - Info: "Expected: ₹{Amount}"
       - Input: "Amount Paid (₹)" (default to expected amount for convenience)
       - Input: "Notes" (optional)
       - "Save Payment" button calls `chitService.updateMemberPayment`.
  </action>
  <verify>
    - Recording a payment correctly updates the status and amount in the DB.
  </verify>
  <done>
    - Organizer can record partial or full payments for any member.
  </done>
</task>

<task type="auto">
  <name>Update Member Detail with Real History</name>
  <files>
    app/member-detail.tsx
  </files>
  <action>
    1. Use `paymentRepo.getPaymentsByMember(memberId)` to fetch all past payments.
    2. Replace the "Payment History" placeholder with a list of historical payments.
    3. Each row: "Month {N}", "₹{Paid}/{Expected}", Status Badge.
  </action>
  <verify>
    - Member detail screen shows accurate historical payment data.
  </verify>
  <done>
    - Audit trail for each member is fully functional.
  </done>
</task>

## Success Criteria
- [ ] Payments can be recorded individually.
- [ ] Member history accurately reflects all past rounds and statuses.
