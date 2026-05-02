import { SQLiteDatabase } from 'expo-sqlite';
import { RoundRepository } from '../database/repositories/roundRepository';
import { AuctionRepository } from '../database/repositories/auctionRepository';
import { MemberRepository } from '../database/repositories/memberRepository';
import { ChitRepository } from '../database/repositories/chitRepository';
import { PaymentRepository } from '../database/repositories/paymentRepository';
import { Payment } from '../database/types';

export class ChitService {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Start Month 1 — Creates a pending round with full monthly_contribution payments.
   * No auction is recorded. Month 1 goes to the organizer (recorded at conclude time).
   */
  async startChitFund(chitId: number): Promise<void> {
    const chitRepo = new ChitRepository(this.db);
    const roundRepo = new RoundRepository(this.db);
    const memberRepo = new MemberRepository(this.db);
    const paymentRepo = new PaymentRepository(this.db);

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

    // Create Month 1 as PENDING — organizer collects payments normally
    const roundId = await roundRepo.createRound({
      chit_id: chitId,
      month_number: 1,
      round_date: new Date().toISOString(),
      is_organizer_month: 1,
      is_double_pata: 0,
      status: 'pending', // NOT 'completed' — month stays active for payment collection
    });

    // Create payment entries for ALL members at FULL monthly contribution (₹30,000)
    await paymentRepo.createPaymentEntries(roundId, members.map(m => m.id), chit.monthly_contribution);
  }

  /**
   * Conclude the current round.
   * For Month 1: Auto-assigns organizer as winner with ₹0 commission.
   * For Month 2+: Requires auction to have been recorded first.
   */
  async concludeCurrentRound(roundId: number): Promise<void> {
    const roundRepo = new RoundRepository(this.db);
    const auctionRepo = new AuctionRepository(this.db);
    const chitRepo = new ChitRepository(this.db);
    const memberRepo = new MemberRepository(this.db);

    const round = await roundRepo.getRoundById(roundId);
    if (!round) throw new Error('Round not found');

    const chit = await chitRepo.getChitById(round.chit_id);
    if (!chit) throw new Error('Chit not found');

    if (round.is_organizer_month === 1) {
      // Month 1: Auto-record organizer as winner with 0 commission
      const members = await memberRepo.getMembersByChit(round.chit_id);
      const organizer = members.find(m => m.is_organizer === 1);
      if (!organizer) throw new Error('Organizer not found');

      const existingAuctions = await auctionRepo.getAuctionsByRound(roundId);
      if (existingAuctions.length === 0) {
        await auctionRepo.recordAuction({
          round_id: roundId,
          winner_member_id: organizer.id,
          commission_amount: 0,
          payout_amount: chit.total_value,
          dividend_per_member: 0,
          effective_contribution: chit.monthly_contribution,
          auction_number: 1,
        });
      }
    } else {
      // Month 2+: Auction MUST have been recorded before concluding
      const auctions = await auctionRepo.getAuctionsByRound(roundId);
      if (auctions.length === 0) {
        throw new Error('Cannot conclude month: Auction has not been recorded yet. Please record the auction result first.');
      }
    }

    await roundRepo.updateRoundStatus(roundId, 'completed', new Date().toISOString());
  }

  /**
   * Start the next month's round.
   * Payments are ALWAYS created at FULL monthly_contribution (₹30,000).
   * Dividend from auction (recorded at END of month) will adjust the SAME month later.
   */
  async startNextRound(chitId: number): Promise<number> {
    const roundRepo = new RoundRepository(this.db);
    const chitRepo = new ChitRepository(this.db);
    const paymentRepo = new PaymentRepository(this.db);
    const memberRepo = new MemberRepository(this.db);
    
    const chit = await chitRepo.getChitById(chitId);
    if (!chit) throw new Error('Chit not found');

    const currentRounds = await roundRepo.getRoundsByChit(chitId);
    const maxMonth = currentRounds.reduce((max, r) => Math.max(max, r.month_number), 0);
    
    if (maxMonth >= chit.duration_months) {
      throw new Error('Chit duration reached. No more rounds can be started.');
    }

    // Ensure previous month is completed
    const prevRound = currentRounds.find(r => r.month_number === maxMonth);
    if (prevRound && prevRound.status !== 'completed') {
      throw new Error(`Cannot start new month: Month ${maxMonth} is not yet concluded.`);
    }

    const nextMonth = maxMonth + 1;
    
    const roundId = await roundRepo.createRound({
      chit_id: chitId,
      month_number: nextMonth,
      round_date: undefined,
      is_organizer_month: 0,
      is_double_pata: 0,
      status: 'pending',
    });

    // Create payment entries at FULL monthly_contribution — always ₹30,000
    // The dividend adjustment happens AFTER auction is recorded (same month)
    const members = await memberRepo.getMembersByChit(chitId);
    await paymentRepo.createPaymentEntries(roundId, members.map(m => m.id), chit.monthly_contribution);

    return roundId;
  }

  /**
   * Record auction result AND recalculate expected amounts for the SAME month.
   * This is called at the END of the month after payments have been collected.
   * 
   * Flow:
   * 1. Record auction (winner, commission, dividend, etc.)
   * 2. Update ALL payment expected_amounts for THIS round to (monthly - dividend)
   * 3. Mark members who overpaid as 'overpaid'
   * 4. Return overpaid members list
   */
  async recordAuctionAndRecalculate(chitId: number, data: {
    round_id: number;
    winner_member_id: number;
    commission_amount: number;
    payout_amount: number;
    dividend_per_member: number;
    effective_contribution: number;
    auction_number: number;
  }): Promise<{ auctionId: number; overpaidMembers: any[] }> {
    const auctionRepo = new AuctionRepository(this.db);
    const paymentRepo = new PaymentRepository(this.db);
    const chitRepo = new ChitRepository(this.db);

    const chit = await chitRepo.getChitById(chitId);
    if (!chit) throw new Error('Chit not found');

    // 1. Record the auction
    const auctionId = await auctionRepo.recordAuction(data);

    // 2. Update expected amounts for THIS round (same month)
    const newExpectedAmount = data.effective_contribution;
    await paymentRepo.updateExpectedAmountsForRound(data.round_id, newExpectedAmount);

    // 3. Mark overpaid members
    await paymentRepo.markOverpaidMembers(data.round_id);

    // 4. Return overpaid members
    const overpaidMembers = await paymentRepo.getOverpaidMembers(data.round_id);

    return { auctionId, overpaidMembers };
  }

  /**
   * Get overpaid members for a specific round.
   */
  async getOverpaidMembers(roundId: number): Promise<any[]> {
    const paymentRepo = new PaymentRepository(this.db);
    return await paymentRepo.getOverpaidMembers(roundId);
  }

  /**
   * Mark a specific payment as refunded.
   */
  async markMemberRefunded(paymentId: number): Promise<void> {
    const paymentRepo = new PaymentRepository(this.db);
    await paymentRepo.markAsRefunded(paymentId);
  }

  /**
   * Legacy method kept for backward compatibility. 
   * Use recordAuctionAndRecalculate() for the correct flow.
   */
  async recordAuctionResult(chitId: number, data: any): Promise<number> {
    const auctionRepo = new AuctionRepository(this.db);
    const auctionId = await auctionRepo.recordAuction(data);
    return auctionId;
  }

  async addPaymentTransaction(paymentId: number, newAmount: number, notes?: string): Promise<void> {
    const paymentRepo = new PaymentRepository(this.db);
    const payment = await paymentRepo.getPaymentById(paymentId);
    if (!payment) throw new Error('Payment record not found');

    const currentPaid = payment.paid_amount || 0;
    const totalPaid = Math.max(0, currentPaid + newAmount); // Don't go below 0
    
    const isRefund = newAmount < 0;
    
    let status: Payment['status'] = 'pending';
    if (totalPaid > payment.expected_amount) {
      status = 'overpaid';
    } else if (totalPaid === payment.expected_amount) {
      // Exactly matched expected — if this was a refund (e.g. overpaid member got money back), mark as 'refunded'
      status = isRefund ? 'refunded' : 'paid';
    } else if (totalPaid > 0) {
      status = 'partial';
    }
    // totalPaid === 0 stays 'pending'

    await paymentRepo.updatePayment(paymentId, {
      paid_amount: totalPaid,
      status,
      notes: notes || undefined,
      payment_date: new Date().toISOString()
    });

    await paymentRepo.addTransaction(paymentId, newAmount, notes);
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
