import { SQLiteDatabase } from 'expo-sqlite';
import { Payment } from '../types';

export class PaymentRepository {
  constructor(private db: SQLiteDatabase) {}

  async createPaymentEntries(roundId: number, memberIds: number[], expectedAmount: number): Promise<void> {
    const placeholders = memberIds.map(() => '(?, ?, ?, ?)').join(', ');
    const values = memberIds.flatMap(memberId => [roundId, memberId, expectedAmount, 'pending']);
    
    await this.db.runAsync(
      `INSERT INTO payments (round_id, member_id, expected_amount, status) VALUES ${placeholders}`,
      values
    );
  }

  async updatePayment(id: number, data: { paid_amount: number, status: Payment['status'], notes?: string, payment_date?: string }): Promise<void> {
    await this.db.runAsync(
      `UPDATE payments SET 
       paid_amount = ?, 
       status = ?, 
       notes = COALESCE(?, notes), 
       payment_date = COALESCE(?, payment_date),
       updated_at = datetime('now')
       WHERE id = ?`,
      [data.paid_amount, data.status, data.notes || null, data.payment_date || null, id]
    );
  }

  async getPaymentsByRound(roundId: number): Promise<(Payment & { member_name: string })[]> {
    return await this.db.getAllAsync<Payment & { member_name: string }>(
      `SELECT p.*, m.name as member_name 
       FROM payments p
       JOIN members m ON p.member_id = m.id
       WHERE p.round_id = ?
       ORDER BY m.name ASC`,
      [roundId]
    );
  }

  async getPaymentsByMember(memberId: number): Promise<(Payment & { month_number: number })[]> {
    return await this.db.getAllAsync<Payment & { month_number: number }>(
      `SELECT p.*, r.month_number 
       FROM payments p
       JOIN monthly_rounds r ON p.round_id = r.id
       WHERE p.member_id = ?
       ORDER BY r.month_number ASC`,
      [memberId]
    );
  }

  async getPaymentSummary(roundId: number): Promise<{ total_expected: number, total_paid: number, paid_count: number, partial_count: number, pending_count: number }> {
    const result = await this.db.getFirstAsync<{
      total_expected: number,
      total_paid: number,
      paid_count: number,
      partial_count: number,
      pending_count: number
    }>(
      `SELECT 
        SUM(expected_amount) as total_expected,
        SUM(paid_amount) as total_paid,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
       FROM payments WHERE round_id = ?`,
      [roundId]
    );
    return result || { total_expected: 0, total_paid: 0, paid_count: 0, partial_count: 0, pending_count: 0 };
  }
  async getPaymentById(id: number): Promise<Payment | null> {
    return await this.db.getFirstAsync<Payment>(
      "SELECT * FROM payments WHERE id = ?",
      [id]
    );
  }

  async updateExpectedAmountsForRound(roundId: number, newExpectedAmount: number): Promise<void> {
    await this.db.runAsync(
      "UPDATE payments SET expected_amount = ?, updated_at = datetime('now') WHERE round_id = ?",
      [newExpectedAmount, roundId]
    );
  }
}
