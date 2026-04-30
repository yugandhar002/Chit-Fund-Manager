import { SQLiteDatabase } from 'expo-sqlite';
import { RoundRepository } from '../database/repositories/roundRepository';
import { AuctionRepository } from '../database/repositories/auctionRepository';
import { MemberRepository } from '../database/repositories/memberRepository';
import { ChitRepository } from '../database/repositories/chitRepository';
import { PaymentRepository } from '../database/repositories/paymentRepository';
import { Payment } from '../database/types';

export class ChitService {
  constructor(private db: SQLiteDatabase) {}

  async startChitFund(chitId: number): Promise<void> {
    const chitRepo = new ChitRepository(this.db);
    const roundRepo = new RoundRepository(this.db);
    const auctionRepo = new AuctionRepository(this.db);
    const memberRepo = new MemberRepository(this.db);

    const chit = await chitRepo.getChitById(chitId);
    if (!chit) throw new Error('Chit not found');

    const members = await memberRepo.getMembersByChit(chitId);
    if (members.length < chit.member_count) {
      throw new Error(`Cannot start fund: Only ${members.length}/${chit.member_count} members added.`);
    }

    const rounds = await roundRepo.getRoundsByChit(chitId);
    if (rounds.length > 0) {
      throw new Error('Chit fund already started');
    }

    const organizer = members.find(m => m.is_organizer === 1);
    if (!organizer) throw new Error('Organizer not found in member list');

    // Start Month 1
    // In many Chit Funds, Month 1 is for the organizer with 0 commission (no auction)
    const roundId = await roundRepo.createRound({
      chit_id: chitId,
      month_number: 1,
      round_date: new Date().toISOString(),
      is_organizer_month: 1,
      is_double_pata: 0,
      status: 'completed',
    });

    await auctionRepo.recordAuction({
      round_id: roundId,
      winner_member_id: organizer.id,
      commission_amount: 0,
      payout_amount: chit.total_value,
      dividend_per_member: 0,
      effective_contribution: chit.monthly_contribution,
      auction_number: 1,
    });

    const paymentRepo = new PaymentRepository(this.db);
    await paymentRepo.createPaymentEntries(roundId, members.map(m => m.id), chit.monthly_contribution);
  }

  async concludeCurrentRound(roundId: number): Promise<void> {
    const roundRepo = new RoundRepository(this.db);
    await roundRepo.updateRoundStatus(roundId, 'completed', new Date().toISOString());
  }

  async startNextRound(chitId: number): Promise<number> {
    const roundRepo = new RoundRepository(this.db);
    const chitRepo = new ChitRepository(this.db);
    
    const chit = await chitRepo.getChitById(chitId);
    const currentRounds = await roundRepo.getRoundsByChit(chitId);
    
    const maxMonth = currentRounds.reduce((max, r) => Math.max(max, r.month_number), 0);
    
    if (chit && maxMonth >= chit.duration_months) {
      throw new Error('Chit duration reached. No more rounds can be started.');
    }

    const nextMonth = maxMonth + 1;
    
    return await roundRepo.createRound({
      chit_id: chitId,
      month_number: nextMonth,
      round_date: null,
      is_organizer_month: 0,
      is_double_pata: 0,
      status: 'pending',
    });
  }

  async recordAuctionResult(chitId: number, data: any): Promise<number> {
    const auctionRepo = new AuctionRepository(this.db);
    const roundRepo = new RoundRepository(this.db);
    const chitRepo = new ChitRepository(this.db);

    const chit = await chitRepo.getChitById(chitId);
    if (!chit) throw new Error('Chit not found');

    const auctionId = await auctionRepo.recordAuction(data);

    const paymentRepo = new PaymentRepository(this.db);
    const memberRepo = new MemberRepository(this.db);
    
    // Generate or update payment entries
    const existingPayments = await paymentRepo.getPaymentsByRound(data.round_id);
    if (existingPayments.length === 0) {
      const members = await memberRepo.getMembersByChit(chitId);
      await paymentRepo.createPaymentEntries(data.round_id, members.map(m => m.id), data.effective_contribution);
    } else {
      // Adjustment for double-pata (second auction)
      // The expected amount for everyone should be reduced by the new dividend
      const newExpected = existingPayments[0].expected_amount - data.dividend_per_member;
      await paymentRepo.updateExpectedAmountsForRound(data.round_id, newExpected);
    }

    // Check for double-pata: when cumulative commission reaches total chit value
    const cumulative = await auctionRepo.getCumulativeCommission(chitId);
    if (cumulative >= chit.total_value) {
      await roundRepo.markAsDoublePata(data.round_id);
    }

    return auctionId;
  }

  async updateMemberPayment(paymentId: number, paidAmount: number, notes?: string): Promise<void> {
    const paymentRepo = new PaymentRepository(this.db);
    const payment = await paymentRepo.getPaymentById(paymentId);
    if (!payment) throw new Error('Payment record not found');

    let status: Payment['status'] = 'pending';
    if (paidAmount >= payment.expected_amount) {
      status = 'paid';
    } else if (paidAmount > 0) {
      status = 'partial';
    }

    await paymentRepo.updatePayment(paymentId, {
      paid_amount: paidAmount,
      status,
      notes,
      payment_date: new Date().toISOString()
    });
  }
  async getFinancialSummary(chitId: number): Promise<any> {
    const auctionRepo = new AuctionRepository(this.db);
    const paymentRepo = new PaymentRepository(this.db);
    const roundRepo = new RoundRepository(this.db);

    const [cumulativeCommission, financials, winners, rounds] = await Promise.all([
      auctionRepo.getCumulativeCommission(chitId),
      paymentRepo.getOverallFinancials(chitId),
      auctionRepo.getWinners(chitId),
      roundRepo.getRoundsByChit(chitId)
    ]);

    const currentMonth = rounds.length > 0 
      ? rounds.reduce((max, r) => Math.max(max, r.month_number), 0)
      : 0;

    return {
      totalCommission: cumulativeCommission,
      totalCollected: financials.total_paid,
      totalExpected: financials.total_expected,
      totalOutstanding: financials.total_expected - financials.total_paid,
      winnerCount: winners.length,
      currentMonth
    };
  }
}
