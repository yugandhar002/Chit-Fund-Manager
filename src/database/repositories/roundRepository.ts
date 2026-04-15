import { SQLiteDatabase } from 'expo-sqlite';
import { MonthlyRound } from '../types';

export class RoundRepository {
  constructor(private db: SQLiteDatabase) {}

  async createRound(data: Omit<MonthlyRound, 'id' | 'created_at'>): Promise<number> {
    const result = await this.db.runAsync(
      `INSERT INTO monthly_rounds (chit_id, month_number, round_date, is_organizer_month, is_double_pata, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.chit_id, data.month_number, data.round_date || null, data.is_organizer_month, data.is_double_pata, data.status]
    );
    return result.lastInsertRowId;
  }

  async getRoundsByChit(chitId: number): Promise<MonthlyRound[]> {
    return await this.db.getAllAsync<MonthlyRound>(
      "SELECT * FROM monthly_rounds WHERE chit_id = ? ORDER BY month_number ASC",
      [chitId]
    );
  }

  async getCurrentRound(chitId: number): Promise<MonthlyRound | null> {
    return await this.db.getFirstAsync<MonthlyRound>(
      "SELECT * FROM monthly_rounds WHERE chit_id = ? AND status = 'pending' ORDER BY month_number ASC LIMIT 1",
      [chitId]
    );
  }

  async updateRoundStatus(id: number, status: 'pending' | 'completed', roundDate?: string): Promise<void> {
    if (roundDate) {
      await this.db.runAsync(
        "UPDATE monthly_rounds SET status = ?, round_date = ? WHERE id = ?",
        [status, roundDate, id]
      );
    } else {
      await this.db.runAsync(
        "UPDATE monthly_rounds SET status = ? WHERE id = ?",
        [status, id]
      );
    }
  }
}
