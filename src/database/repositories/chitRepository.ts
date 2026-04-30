import { SQLiteDatabase } from 'expo-sqlite';
import { Chit } from '../types';

export class ChitRepository {
  constructor(private db: SQLiteDatabase) {}

  async createChit(data: Omit<Chit, 'id' | 'created_at'>): Promise<number> {
    const result = await this.db.runAsync(
      `INSERT INTO chits (name, total_value, member_count, monthly_contribution, duration_months, start_date, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.name, data.total_value, data.member_count, data.monthly_contribution, data.duration_months, data.start_date, data.status]
    );
    return result.lastInsertRowId;
  }

  async getActiveChit(): Promise<Chit | null> {
    return await this.db.getFirstAsync<Chit>(
      "SELECT * FROM chits WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"
    );
  }

  async updateChitStatus(id: number, status: 'active' | 'completed'): Promise<void> {
    await this.db.runAsync(
      "UPDATE chits SET status = ? WHERE id = ?",
      [status, id]
    );
  }

  async getChitById(id: number): Promise<Chit | null> {
    return await this.db.getFirstAsync<Chit>(
      "SELECT * FROM chits WHERE id = ?",
      [id]
    );
  }

  async getAllChits(): Promise<Chit[]> {
    return await this.db.getAllAsync<Chit>(
      "SELECT * FROM chits ORDER BY created_at DESC"
    );
  }
}
