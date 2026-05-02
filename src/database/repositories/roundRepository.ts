import { supabase } from '../supabase';
import { MonthlyRound } from '../types';

export class RoundRepository {
  async createRound(data: Omit<MonthlyRound, 'id' | 'created_at'>): Promise<number> {
    const { data: result, error } = await supabase
      .from('monthly_rounds')
      .insert([data])
      .select('id')
      .single();

    if (error) throw error;
    return result.id;
  }

  async getRoundsByChit(chitId: number): Promise<MonthlyRound[]> {
    const { data, error } = await supabase
      .from('monthly_rounds')
      .select('*')
      .eq('chit_id', chitId)
      .order('month_number', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getRoundById(id: number): Promise<MonthlyRound | null> {
    const { data, error } = await supabase
      .from('monthly_rounds')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async getCurrentRound(chitId: number): Promise<MonthlyRound | null> {
    const { data, error } = await supabase
      .from('monthly_rounds')
      .select('*')
      .eq('chit_id', chitId)
      .eq('status', 'pending')
      .order('month_number', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async updateRoundStatus(id: number, status: 'pending' | 'completed', roundDate?: string): Promise<void> {
    const updateData: any = { status };
    if (roundDate) {
      updateData.round_date = roundDate;
    }

    const { error } = await supabase
      .from('monthly_rounds')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  }

  async markAsDoublePata(id: number): Promise<void> {
    const { error } = await supabase
      .from('monthly_rounds')
      .update({ is_double_pata: 1 })
      .eq('id', id);

    if (error) throw error;
  }
}
