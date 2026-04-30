---
phase: 4
plan: 1
wave: 1
---

# Plan 4.1: Payment Generation Logic

## Objective
Automatically generate payment records for each member when a month starts or an auction is finalized. This ensures the organizer always has an accurate list of expected collections.

## Context
- src/services/chitService.ts
- src/database/repositories/paymentRepository.ts
- src/database/repositories/memberRepository.ts

## Tasks

<task type="auto">
  <name>Implement Payment Generation in ChitService</name>
  <files>
    src/services/chitService.ts
  </files>
  <action>
    1. Import `PaymentRepository` and `MemberRepository`.
    2. Update `startChitFund`: After recording Month 1 auction, fetch all members and call `paymentRepo.createPaymentEntries` for the round with `expectedAmount = chit.monthly_contribution`.
    3. Update `recordAuctionResult`: 
       - Fetch all members.
       - Check if payments for this round already exist.
       - If NOT: Create 20 payment entries with `expectedAmount = data.effective_contribution`.
       - If YES: Update all 20 entries by subtracting `data.dividend_per_member` from their `expected_amount`. This handles double-pata months where a second auction reduces the monthly contribution further.
  </action>
  <verify>
    - recordAuctionResult correctly creates or updates 20 payment records.
  </verify>
  <done>
    - Payment records are automatically generated with correct amounts based on auction results.
  </done>
</task>

<task type="auto">
  <name>Implement recordPayment in ChitService</name>
  <files>
    src/services/chitService.ts
  </files>
  <action>
    1. Add `updateMemberPayment(paymentId: number, paidAmount: number, notes?: string)` to `ChitService`.
    2. Logic:
       - Fetch payment by ID (need to add `getPaymentById` to `PaymentRepository` first).
       - Calculate status: 
         - `paid` if `paidAmount >= expected_amount`
         - `partial` if `paidAmount > 0` and `< expected_amount`
         - `pending` if `paidAmount == 0`
       - Call `paymentRepo.updatePayment`.
  </action>
  <verify>
    - updateMemberPayment correctly sets status and updates the record.
  </verify>
  <done>
    - Service layer supports recording payments from the UI.
  </done>
</task>

## Success Criteria
- [ ] Round 1 generates 20 payment entries of ₹30,000 each.
- [ ] Auction rounds generate entries with `monthly - dividend`.
- [ ] Double-pata rounds adjust existing entries correctly.
