import { supabase } from '../supabase';
import { Payment } from '../types';

export class PaymentRepository {
  async createPaymentEntries(roundId: number, memberIds: number[], expectedAmount: number): Promise<void> {
    const entries = memberIds.map(memberId => ({
      round_id: roundId,
      member_id: memberId,
      expected_amount: expectedAmount,
      status: 'pending'
    }));

    const { error } = await supabase.from('payments').insert(entries);
    if (error) throw error;
  }

  async updatePayment(id: number, data: { paid_amount: number, status: Payment['status'], notes?: string, payment_date?: string }): Promise<void> {
    const updateData: any = {
      paid_amount: data.paid_amount,
      status: data.status,
      updated_at: new Date().toISOString()
    };
    if (data.notes) updateData.notes = data.notes;
    if (data.payment_date) updateData.payment_date = data.payment_date;

    const { error } = await supabase.from('payments').update(updateData).eq('id', id);
    if (error) throw error;
  }

  async getPaymentsByRound(roundId: number): Promise<(Payment & { member_name: string })[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*, members!member_id(name)')
      .eq('round_id', roundId);

    if (error) throw error;
    
    // Process and sort locally to match old behavior
    const result = (data || []).map((p: any) => ({
      ...p,
      member_name: p.members?.name || 'Unknown'
    }));
    return result.sort((a, b) => a.member_name.localeCompare(b.member_name));
  }

  async getPaymentsByMember(memberId: number): Promise<(Payment & { month_number: number })[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*, monthly_rounds!round_id(month_number)')
      .eq('member_id', memberId);

    if (error) throw error;

    const result = (data || []).map((p: any) => ({
      ...p,
      month_number: p.monthly_rounds?.month_number || 0
    }));
    return result.sort((a, b) => a.month_number - b.month_number);
  }

  async getPaymentSummary(roundId: number): Promise<{ total_expected: number, total_paid: number, paid_count: number, partial_count: number, pending_count: number }> {
    const { data, error } = await supabase
      .from('payments')
      .select('expected_amount, paid_amount, status')
      .eq('round_id', roundId);

    if (error) throw error;

    const summary = { total_expected: 0, total_paid: 0, paid_count: 0, partial_count: 0, pending_count: 0 };
    if (!data) return summary;

    data.forEach(p => {
      summary.total_expected += p.expected_amount || 0;
      summary.total_paid += p.paid_amount || 0;
      if (p.status === 'paid' || p.status === 'refunded' || p.status === 'overpaid') summary.paid_count++;
      else if (p.status === 'partial') summary.partial_count++;
      else if (p.status === 'pending') summary.pending_count++;
    });

    return summary;
  }

  async getPaymentById(id: number): Promise<Payment | null> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async updateExpectedAmountsForRound(roundId: number, newExpectedAmount: number): Promise<void> {
    const { error } = await supabase
      .from('payments')
      .update({ 
        expected_amount: newExpectedAmount,
        updated_at: new Date().toISOString()
      })
      .eq('round_id', roundId);

    if (error) throw error;
  }

  async getOverallFinancials(chitId: number): Promise<{ total_expected: number, total_paid: number }> {
    const { data: rounds, error: roundsError } = await supabase
      .from('monthly_rounds')
      .select('id')
      .eq('chit_id', chitId);

    if (roundsError) throw roundsError;
    if (!rounds || rounds.length === 0) return { total_expected: 0, total_paid: 0 };

    const roundIds = rounds.map(r => r.id);
    const { data, error } = await supabase
      .from('payments')
      .select('expected_amount, paid_amount')
      .in('round_id', roundIds);

    if (error) throw error;

    let total_expected = 0, total_paid = 0;
    data?.forEach(p => {
      total_expected += p.expected_amount || 0;
      total_paid += p.paid_amount || 0;
    });

    return { total_expected, total_paid };
  }

  async getOutstandingDuesByMember(chitId: number): Promise<{ member_id: number, member_name: string, total_due: number, total_overpaid: number, net_due: number }[]> {
    const { data: rounds, error: roundsError } = await supabase
      .from('monthly_rounds')
      .select('id')
      .eq('chit_id', chitId);

    if (roundsError) throw roundsError;
    if (!rounds || rounds.length === 0) return [];

    const roundIds = rounds.map(r => r.id);
    const { data, error } = await supabase
      .from('payments')
      .select('member_id, expected_amount, paid_amount, members!member_id(name)')
      .in('round_id', roundIds);

    if (error) throw error;

    const duesMap = new Map<number, { member_id: number, member_name: string, total_due: number, total_overpaid: number, net_due: number }>();
    
    data?.forEach((p: any) => {
      const balance = (p.expected_amount || 0) - (p.paid_amount || 0);
      
      if (!duesMap.has(p.member_id)) {
        duesMap.set(p.member_id, {
          member_id: p.member_id,
          member_name: p.members?.name || 'Unknown',
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

    // Only return members who have some outstanding or overpaid balance
    const result = Array.from(duesMap.values()).filter(m => m.net_due !== 0 || m.total_due > 0 || m.total_overpaid > 0);
    
    // Sort by net due descending (those who owe the most at top)
    return result.sort((a, b) => b.net_due - a.net_due);
  }

  async addTransaction(paymentId: number, amount: number, notes?: string): Promise<void> {
    const { error } = await supabase
      .from('payment_transactions')
      .insert([{ payment_id: paymentId, amount, notes }]);
    
    if (error) throw error;
  }

  async getTransactionsByPayment(paymentId: number): Promise<any[]> {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('payment_id', paymentId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getOverpaidMembers(roundId: number): Promise<{ payment_id: number, member_id: number, member_name: string, paid_amount: number, expected_amount: number, refund_amount: number, status: string }[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('id, member_id, paid_amount, expected_amount, status, members!member_id(name)')
      .eq('round_id', roundId);

    if (error) throw error;

    const overpaid = (data || [])
      .filter(p => (p.paid_amount || 0) > (p.expected_amount || 0))
      .map((p: any) => ({
        payment_id: p.id,
        member_id: p.member_id,
        member_name: p.members?.name || 'Unknown',
        paid_amount: p.paid_amount || 0,
        expected_amount: p.expected_amount || 0,
        refund_amount: (p.paid_amount || 0) - (p.expected_amount || 0),
        status: p.status
      }));

    return overpaid.sort((a, b) => b.refund_amount - a.refund_amount);
  }

  async markAsRefunded(paymentId: number): Promise<void> {
    const { error } = await supabase
      .from('payments')
      .update({ 
        status: 'refunded',
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (error) throw error;
  }

  async markOverpaidMembers(roundId: number): Promise<void> {
    // Supabase update based on condition is tricky from JS client without RPC.
    // We will fetch overpaid payments, then update them.
    const { data, error } = await supabase
      .from('payments')
      .select('id, paid_amount, expected_amount, status')
      .eq('round_id', roundId);

    if (error) throw error;

    const toUpdate = (data || []).filter(p => 
      (p.paid_amount || 0) > (p.expected_amount || 0) && p.status !== 'refunded'
    );

    for (const payment of toUpdate) {
      await supabase
        .from('payments')
        .update({ 
          status: 'overpaid',
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);
    }
  }
}
