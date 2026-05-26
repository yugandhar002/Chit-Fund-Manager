import { RoundRepository } from '../database/repositories/roundRepository';
import { AuctionRepository } from '../database/repositories/auctionRepository';
import { MemberRepository } from '../database/repositories/memberRepository';
import { ChitRepository } from '../database/repositories/chitRepository';
import { PaymentRepository } from '../database/repositories/paymentRepository';
import { Payment } from '../database/types';

export class ChitService {
  private static healingChits = new Set<number>();
  async startChitFund(chitId: number): Promise<void> {
    const chitRepo = new ChitRepository();
    const roundRepo = new RoundRepository();
    const memberRepo = new MemberRepository();
    const paymentRepo = new PaymentRepository();

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

    const roundId = await roundRepo.createRound({
      chit_id: chitId,
      month_number: 1,
      round_date: new Date().toISOString(),
      is_organizer_month: 1,
      is_double_pata: 0,
      status: 'pending',
    });

    await paymentRepo.createPaymentEntries(roundId, members.map(m => m.id), chit.monthly_contribution);
  }

  async concludeCurrentRound(roundId: number): Promise<void> {
    const roundRepo = new RoundRepository();
    const auctionRepo = new AuctionRepository();
    const chitRepo = new ChitRepository();
    const memberRepo = new MemberRepository();

    const round = await roundRepo.getRoundById(roundId);
    if (!round) throw new Error('Round not found');

    const chit = await chitRepo.getChitById(round.chit_id);
    if (!chit) throw new Error('Chit not found');

    if (round.is_organizer_month === 1) {
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
      const auctions = await auctionRepo.getAuctionsByRound(roundId);
      if (auctions.length === 0) {
        throw new Error('Cannot conclude month: Auction has not been recorded yet.');
      }
    }

    await roundRepo.updateRoundStatus(roundId, 'completed', new Date().toISOString());
  }

  async startNextRound(chitId: number): Promise<number> {
    const roundRepo = new RoundRepository();
    const chitRepo = new ChitRepository();
    const paymentRepo = new PaymentRepository();
    const memberRepo = new MemberRepository();
    
    const chit = await chitRepo.getChitById(chitId);
    if (!chit) throw new Error('Chit not found');

    const currentRounds = await roundRepo.getRoundsByChit(chitId);
    const maxMonth = currentRounds.reduce((max, r) => Math.max(max, r.month_number), 0);
    
    if (maxMonth >= chit.duration_months) {
      throw new Error('Chit duration reached. No more rounds can be started.');
    }

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

    const members = await memberRepo.getMembersByChit(chitId);
    await paymentRepo.createPaymentEntries(roundId, members.map(m => m.id), chit.monthly_contribution);

    return roundId;
  }

  async recordAuctionAndRecalculate(chitId: number, data: {
    round_id: number;
    winner_member_id: number;
    commission_amount: number;
    payout_amount: number;
    dividend_per_member: number;
    effective_contribution: number;
    auction_number: number;
  }): Promise<{ auctionId: number; overpaidMembers: any[] }> {
    const auctionRepo = new AuctionRepository();
    const paymentRepo = new PaymentRepository();
    const chitRepo = new ChitRepository();

    const chit = await chitRepo.getChitById(chitId);
    if (!chit) throw new Error('Chit not found');

    const auctionId = await auctionRepo.recordAuction(data);

    const newExpectedAmount = data.effective_contribution;
    await paymentRepo.updateExpectedAmountsForRound(data.round_id, newExpectedAmount);
    await paymentRepo.markOverpaidMembers(data.round_id);

    const overpaidMembers = await paymentRepo.getOverpaidMembers(data.round_id);
    return { auctionId, overpaidMembers };
  }

  async getOverpaidMembers(roundId: number): Promise<any[]> {
    const paymentRepo = new PaymentRepository();
    return await paymentRepo.getOverpaidMembers(roundId);
  }

  async markMemberRefunded(paymentId: number): Promise<void> {
    const paymentRepo = new PaymentRepository();
    await paymentRepo.markAsRefunded(paymentId);
  }

  async recordAuctionResult(chitId: number, data: any): Promise<number> {
    const auctionRepo = new AuctionRepository();
    return await auctionRepo.recordAuction(data);
  }

  async addPaymentTransaction(paymentId: number, newAmount: number, notes?: string, paymentDate?: string): Promise<void> {
    const paymentRepo = new PaymentRepository();
    const payment = await paymentRepo.getPaymentById(paymentId);
    if (!payment) throw new Error('Payment record not found');

    const currentPaid = payment.paid_amount || 0;
    const totalPaid = Math.max(0, currentPaid + newAmount);
    
    const isRefund = newAmount < 0;
    
    let status: Payment['status'] = 'pending';
    if (totalPaid > payment.expected_amount) {
      status = 'overpaid';
    } else if (totalPaid === payment.expected_amount) {
      status = isRefund ? 'refunded' : 'paid';
    } else if (totalPaid > 0) {
      status = 'partial';
    }

    const finalDate = paymentDate || new Date().toISOString();

    await paymentRepo.updatePayment(paymentId, {
      paid_amount: totalPaid,
      status,
      notes: notes || undefined,
      payment_date: finalDate
    });

    await paymentRepo.addTransaction(paymentId, newAmount, notes, finalDate);
  }

  async recalculatePayment(paymentId: number): Promise<void> {
    const paymentRepo = new PaymentRepository();
    const payment = await paymentRepo.getPaymentById(paymentId);
    if (!payment) throw new Error('Payment record not found');

    const transactions = await paymentRepo.getTransactionsByPayment(paymentId);
    const totalPaid = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    let status: Payment['status'] = 'pending';
    if (totalPaid > payment.expected_amount) {
      status = 'overpaid';
    } else if (totalPaid === payment.expected_amount) {
      status = payment.status === 'refunded' ? 'refunded' : 'paid';
    } else if (totalPaid > 0) {
      status = 'partial';
    }

    const latestTx = transactions[0];

    await paymentRepo.updatePayment(paymentId, {
      paid_amount: totalPaid,
      status,
      notes: latestTx ? (latestTx.notes || null) : null,
      payment_date: latestTx ? (latestTx.payment_date || null) : null
    });
  }

  async updatePaymentTransaction(paymentId: number, transactionId: number, amount: number, notes?: string, paymentDate?: string): Promise<void> {
    const paymentRepo = new PaymentRepository();
    await paymentRepo.updateTransaction(transactionId, { amount, notes, payment_date: paymentDate });
    await this.recalculatePayment(paymentId);
  }

  async deletePaymentTransaction(paymentId: number, transactionId: number): Promise<void> {
    const paymentRepo = new PaymentRepository();
    await paymentRepo.deleteTransaction(transactionId);
    await this.recalculatePayment(paymentId);
  }

  async getFinancialSummary(chitId: number): Promise<any> {
    const auctionRepo = new AuctionRepository();
    const paymentRepo = new PaymentRepository();
    const roundRepo = new RoundRepository();

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

  async healMissingPayments(chitId: number): Promise<void> {
    if (ChitService.healingChits.has(chitId)) {
      return;
    }
    ChitService.healingChits.add(chitId);

    try {
      const memberRepo = new MemberRepository();
      const roundRepo = new RoundRepository();
      const paymentRepo = new PaymentRepository();
      const chitRepo = new ChitRepository();

      const chit = await chitRepo.getChitById(chitId);
      if (!chit) return;

      const members = await memberRepo.getMembersByChit(chitId);
      const rounds = await roundRepo.getRoundsByChit(chitId);

      if (members.length === 0 || rounds.length === 0) return;

      for (const round of rounds) {
        const existingPayments = await paymentRepo.getPaymentsByRound(round.id);
        const existingMemberIds = new Set(existingPayments.map(p => p.member_id));

        const missingMembers = members.filter(m => !existingMemberIds.has(m.id));

        if (missingMembers.length > 0) {
          let expectedAmount = chit.monthly_contribution;
          if (existingPayments.length > 0) {
            expectedAmount = existingPayments[0].expected_amount;
          }

          const missingMemberIds = missingMembers.map(m => m.id);
          await paymentRepo.createPaymentEntries(round.id, missingMemberIds, expectedAmount);
          console.log(`Healed ${missingMemberIds.length} missing payments for round ${round.id}`);
        }
      }
    } finally {
      ChitService.healingChits.delete(chitId);
    }
  }
}
