import { LocalDatabase } from '../localDb';
import { MonthlyRound } from '../types';

export class RoundRepository {
  async createRound(data: Omit<MonthlyRound, 'id' | 'created_at'>): Promise<number> {
    const result = await LocalDatabase.insert<MonthlyRound>('monthly_rounds', data);
    return result.id;
  }

  async getRoundsByChit(chitId: number): Promise<MonthlyRound[]> {
    const rows = LocalDatabase.getTable<MonthlyRound>('monthly_rounds');
    return rows
      .filter(r => r.chit_id === chitId)
      .sort((a, b) => a.month_number - b.month_number);
  }

  async getRoundById(id: number): Promise<MonthlyRound | null> {
    return LocalDatabase.getById<MonthlyRound>('monthly_rounds', id);
  }

  async getCurrentRound(chitId: number): Promise<MonthlyRound | null> {
    const rows = LocalDatabase.getTable<MonthlyRound>('monthly_rounds');
    const pending = rows
      .filter(r => r.chit_id === chitId && r.status === 'pending')
      .sort((a, b) => a.month_number - b.month_number);
    
    return pending.length > 0 ? pending[0] : null;
  }

  async updateRoundStatus(id: number, status: 'pending' | 'completed', roundDate?: string): Promise<void> {
    const updateData: any = { status };
    if (roundDate) {
      updateData.round_date = roundDate;
    }
    await LocalDatabase.update<MonthlyRound>('monthly_rounds', id, updateData);
  }

  async markAsDoublePata(id: number): Promise<void> {
    await LocalDatabase.update<MonthlyRound>('monthly_rounds', id, { is_double_pata: 1 });
  }
}
