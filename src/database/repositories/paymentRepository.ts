import { LocalDatabase } from '../localDb';
import { Payment, Member, MonthlyRound, PaymentTransaction } from '../types';

export class PaymentRepository {
  async createPaymentEntries(roundId: number, memberIds: number[], expectedAmount: number): Promise<void> {
    for (const memberId of memberIds) {
      await LocalDatabase.insert<Payment>('payments', {
        round_id: roundId,
        member_id: memberId,
        expected_amount: expectedAmount,
        paid_amount: 0,
        status: 'pending',
        notes: ''
      });
    }
  }

  async updatePayment(id: number, data: { paid_amount: number, status: Payment['status'], notes?: string | null, payment_date?: string | null }): Promise<void> {
    const updateData: any = {
      paid_amount: data.paid_amount,
      status: data.status,
    };
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.payment_date !== undefined) updateData.payment_date = data.payment_date;

    await LocalDatabase.update<Payment>('payments', id, updateData);
  }

  async getPaymentsByRound(roundId: number): Promise<(Payment & { member_name: string })[]> {
    const payments = LocalDatabase.getTable<Payment>('payments')
      .filter(p => p.round_id === roundId);

    const result = payments.map(p => {
      const member = LocalDatabase.getById<Member>('members', p.member_id);
      return {
        ...p,
        member_name: member?.name || 'Unknown'
      };
    });

    return result.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      return a.member_name.localeCompare(b.member_name);
    });
  }

  async getPaymentsByMember(memberId: number): Promise<(Payment & { month_number: number })[]> {
    const payments = LocalDatabase.getTable<Payment>('payments')
      .filter(p => p.member_id === memberId);

    const result = payments.map(p => {
      const round = LocalDatabase.getById<MonthlyRound>('monthly_rounds', p.round_id);
      return {
        ...p,
        month_number: round?.month_number || 0
      };
    });

    return result.sort((a, b) => a.month_number - b.month_number);
  }

  async getPaymentSummary(roundId: number): Promise<{ total_expected: number, total_paid: number, paid_count: number, partial_count: number, pending_count: number }> {
    const payments = LocalDatabase.getTable<Payment>('payments')
      .filter(p => p.round_id === roundId);

    const summary = { total_expected: 0, total_paid: 0, paid_count: 0, partial_count: 0, pending_count: 0 };

    payments.forEach(p => {
      summary.total_expected += p.expected_amount || 0;
      summary.total_paid += p.paid_amount || 0;
      if (p.status === 'paid' || p.status === 'refunded' || p.status === 'overpaid') summary.paid_count++;
      else if (p.status === 'partial') summary.partial_count++;
      else if (p.status === 'pending') summary.pending_count++;
    });

    return summary;
  }

  async getPaymentById(id: number): Promise<Payment | null> {
    return LocalDatabase.getById<Payment>('payments', id);
  }

  async updateExpectedAmountsForRound(roundId: number, newExpectedAmount: number): Promise<void> {
    const payments = LocalDatabase.getTable<Payment>('payments')
      .filter(p => p.round_id === roundId);

    for (const payment of payments) {
      await LocalDatabase.update<Payment>('payments', payment.id, {
        expected_amount: newExpectedAmount
      });
    }
  }

  async getOverallFinancials(chitId: number): Promise<{ total_expected: number, total_paid: number }> {
    const roundIds = new Set(
      LocalDatabase.getTable<MonthlyRound>('monthly_rounds')
        .filter(r => r.chit_id === chitId)
        .map(r => r.id)
    );

    if (roundIds.size === 0) return { total_expected: 0, total_paid: 0 };

    const payments = LocalDatabase.getTable<Payment>('payments')
      .filter(p => roundIds.has(p.round_id));

    let total_expected = 0, total_paid = 0;
    payments.forEach(p => {
      total_expected += p.expected_amount || 0;
      total_paid += p.paid_amount || 0;
    });

    return { total_expected, total_paid };
  }

  async getOutstandingDuesByMember(chitId: number): Promise<{ member_id: number, member_name: string, total_due: number, total_overpaid: number, net_due: number }[]> {
    const roundIds = new Set(
      LocalDatabase.getTable<MonthlyRound>('monthly_rounds')
        .filter(r => r.chit_id === chitId)
        .map(r => r.id)
    );

    if (roundIds.size === 0) return [];

    const payments = LocalDatabase.getTable<Payment>('payments')
      .filter(p => roundIds.has(p.round_id));

    const duesMap = new Map<number, { member_id: number, member_name: string, total_due: number, total_overpaid: number, net_due: number }>();
    
    payments.forEach(p => {
      const balance = (p.expected_amount || 0) - (p.paid_amount || 0);
      
      if (!duesMap.has(p.member_id)) {
        const member = LocalDatabase.getById<Member>('members', p.member_id);
        duesMap.set(p.member_id, {
          member_id: p.member_id,
          member_name: member?.name || 'Unknown',
          total_due: 0,
          total_overpaid: 0,
          net_due: 0
        });
      }
      
      const record = duesMap.get(p.member_id)!;
      
      if (balance > 0) {
        record.total_due += balance;
      } else if (balance < 0) {
        record.total_overpaid += Math.abs(balance);
      }
      
      record.net_due += balance;
    });

    const result = Array.from(duesMap.values()).filter(m => m.net_due !== 0 || m.total_due > 0 || m.total_overpaid > 0);
    return result.sort((a, b) => b.net_due - a.net_due);
  }

  async addTransaction(paymentId: number, amount: number, notes?: string): Promise<void> {
    const payment = LocalDatabase.getById<Payment>('payments', paymentId);
    if (!payment) return;

    await LocalDatabase.insert<PaymentTransaction>('payment_transactions', {
      payment_id: paymentId,
      amount,
      notes: notes || '',
      payment_date: new Date().toISOString()
    });
  }

  async getTransactionsByPayment(paymentId: number): Promise<any[]> {
    const txs = LocalDatabase.getTable<PaymentTransaction>('payment_transactions')
      .filter(t => t.payment_id === paymentId);

    return txs.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
  }

  async updateTransaction(id: number, data: { amount: number, notes?: string, payment_date?: string }): Promise<void> {
    const updateData: any = {
      amount: data.amount,
      notes: data.notes || ''
    };
    if (data.payment_date) {
      updateData.payment_date = data.payment_date;
    }
    await LocalDatabase.update<PaymentTransaction>('payment_transactions', id, updateData);
  }

  async deleteTransaction(id: number): Promise<void> {
    await LocalDatabase.delete('payment_transactions', id);
  }

  async getOverpaidMembers(roundId: number): Promise<{ payment_id: number, member_id: number, member_name: string, paid_amount: number, expected_amount: number, refund_amount: number, status: string }[]> {
    const payments = LocalDatabase.getTable<Payment>('payments')
      .filter(p => p.round_id === roundId);

    const overpaid = payments
      .filter(p => (p.paid_amount || 0) > (p.expected_amount || 0))
      .map(p => {
        const member = LocalDatabase.getById<Member>('members', p.member_id);
        return {
          payment_id: p.id,
          member_id: p.member_id,
          member_name: member?.name || 'Unknown',
          paid_amount: p.paid_amount || 0,
          expected_amount: p.expected_amount || 0,
          refund_amount: (p.paid_amount || 0) - (p.expected_amount || 0),
          status: p.status
        };
      });

    return overpaid.sort((a, b) => b.refund_amount - a.refund_amount);
  }

  async markAsRefunded(paymentId: number): Promise<void> {
    await LocalDatabase.update<Payment>('payments', paymentId, { status: 'refunded' });
  }

  async markOverpaidMembers(roundId: number): Promise<void> {
    const payments = LocalDatabase.getTable<Payment>('payments')
      .filter(p => p.round_id === roundId);

    const toUpdate = payments.filter(p => 
      (p.paid_amount || 0) > (p.expected_amount || 0) && p.status !== 'refunded'
    );

    for (const payment of toUpdate) {
      await LocalDatabase.update<Payment>('payments', payment.id, { status: 'overpaid' });
    }
  }
}
