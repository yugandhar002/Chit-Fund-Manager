import { supabase } from '../supabase';
import { Member } from '../types';

export class MemberRepository {
  async addMember(data: Omit<Member, 'id' | 'created_at'>): Promise<number> {
    const { data: result, error } = await supabase
      .from('members')
      .insert([data])
      .select('id')
      .single();

    if (error) throw error;
    return result.id;
  }

  async getMembersByChit(chitId: number): Promise<Member[]> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('chit_id', chitId)
      .order('is_organizer', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getMemberById(id: number): Promise<Member | null> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async updateMember(id: number, data: Partial<Omit<Member, 'id' | 'chit_id' | 'created_at'>>): Promise<void> {
    const { error } = await supabase
      .from('members')
      .update(data)
      .eq('id', id);

    if (error) throw error;
  }

  async deleteMember(id: number): Promise<void> {
    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getAvailableBidders(chitId: number): Promise<Member[]> {
    // 1. Get all winners for this chit
    const { data: rounds, error: roundsError } = await supabase
      .from('monthly_rounds')
      .select('id')
      .eq('chit_id', chitId);
      
    if (roundsError) throw roundsError;
    
    let winnerIds: number[] = [];
    if (rounds && rounds.length > 0) {
      const roundIds = rounds.map(r => r.id);
      const { data: auctions, error: auctionsError } = await supabase
        .from('auctions')
        .select('winner_member_id')
        .in('round_id', roundIds);
        
      if (auctionsError) throw auctionsError;
      if (auctions) {
        winnerIds = auctions.map(a => a.winner_member_id);
      }
    }

    // 2. Get non-winners
    let query = supabase
      .from('members')
      .select('*')
      .eq('chit_id', chitId)
      .eq('is_organizer', 0);
      
    if (winnerIds.length > 0) {
      query = query.not('id', 'in', `(${winnerIds.join(',')})`);
    }

    const { data, error } = await query.order('name', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }
}
