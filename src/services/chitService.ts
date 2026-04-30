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
    
    const roundId = await roundRepo.createRound({
      chit_id: chitId,
      month_number: nextMonth,
      round_date: null,
      is_organizer_month: 0,
      is_double_pata: 0,
      status: 'pending',
    });

    // Create payment entries immediately for 'Collection First' logic
    const paymentRepo = new PaymentRepository(this.db);
    const memberRepo = new MemberRepository(this.db);
    const auctionRepo = new AuctionRepository(this.db);
    
    let expectedAmount = chit.monthly_contribution;
    
    if (nextMonth > 1) {
      // Find the round for (nextMonth - 1)
      const prevRound = currentRounds.find(r => r.month_number === maxMonth);
      if (prevRound) {
        // Sum dividends from all auctions in the previous month
        const prevAuctions = await auctionRepo.getAuctionsByRound(prevRound.id);
        const totalPrevDividend = prevAuctions.reduce((sum, a) => sum + a.dividend_per_member, 0);
        expectedAmount = chit.monthly_contribution - totalPrevDividend;
      }
    }

    const members = await memberRepo.getMembersByChit(chitId);
    await paymentRepo.createPaymentEntries(roundId, members.map(m => m.id), expectedAmount);

    return roundId;
  }

  async recordAuctionResult(chitId: number, data: any): Promise<number> {
    const auctionRepo = new AuctionRepository(this.db);
    const chitRepo = new ChitRepository(this.db);

    const chit = await chitRepo.getChitById(chitId);
    if (!chit) throw new Error('Chit not found');

    const auctionId = await auctionRepo.recordAuction(data);
    return auctionId;
  }

  async addPaymentTransaction(paymentId: number, newAmount: number, notes?: string): Promise<void> {
    const paymentRepo = new PaymentRepository(this.db);
    const payment = await paymentRepo.getPaymentById(paymentId);
    if (!payment) throw new Error('Payment record not found');

    const currentPaid = payment.paid_amount || 0;
    const totalPaid = currentPaid + newAmount;
    
    let status: Payment['status'] = 'pending';
    if (totalPaid >= payment.expected_amount) {
      status = 'paid';
    } else if (totalPaid > 0) {
      status = 'partial';
    }

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
