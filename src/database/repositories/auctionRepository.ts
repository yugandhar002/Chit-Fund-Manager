import { supabase } from '../supabase';
import { Auction } from '../types';

export class AuctionRepository {
  async recordAuction(data: Omit<Auction, 'id' | 'created_at'>): Promise<number> {
    const { data: result, error } = await supabase
      .from('auctions')
      .insert(data)
      .select('id')
      .single();
    if (error) throw error;
    return result.id;
  }

  async getAuctionsByRound(roundId: number): Promise<Auction[]> {
    const { data, error } = await supabase
      .from('auctions')
      .select('*')
      .eq('round_id', roundId);
    if (error) throw error;
    return data || [];
  }

  async getAuctionHistory(chitId: number): Promise<(Auction & { winner_name: string, month_number: number })[]> {
    const { data: rounds, error: roundsError } = await supabase
      .from('monthly_rounds')
      .select('id, month_number')
      .eq('chit_id', chitId);
    if (roundsError) throw roundsError;
    
    if (!rounds || rounds.length === 0) return [];
    
    const roundIds = rounds.map((r: any) => r.id);
    const roundMap = new Map(rounds.map((r: any) => [r.id, r.month_number]));

    const { data: auctionsData, error: auctionsError } = await supabase
      .from('auctions')
      .select(`
        *,
        members (
          name,
          phone
        )
      `)
      .in('round_id', roundIds);
      
    if (auctionsError) throw auctionsError;
    
    const auctions = auctionsData || [];

    const history = auctions.map((a: any) => ({
      ...a,
      winner_name: a.members?.name || 'Unknown',
      winner_phone: a.members?.phone || '',
      month_number: roundMap.get(a.round_id) || 0
    }));

    return history.sort((a: any, b: any) => {
      if (a.month_number === b.month_number) {
        return a.auction_number - b.auction_number;
      }
      return a.month_number - b.month_number;
    });
  }

  async getCumulativeCommission(chitId: number): Promise<number> {
    const { data: rounds, error: roundsError } = await supabase
      .from('monthly_rounds')
      .select('id')
      .eq('chit_id', chitId);
    if (roundsError) throw roundsError;

    if (!rounds || rounds.length === 0) return 0;
    const roundIds = rounds.map((r: any) => r.id);

    const { data: auctions, error: auctionsError } = await supabase
      .from('auctions')
      .select('commission_amount')
      .in('round_id', roundIds);
    if (auctionsError) throw auctionsError;

    return (auctions || []).reduce((sum: number, a: any) => sum + (a.commission_amount || 0), 0);
  }

  async getWinners(chitId: number): Promise<number[]> {
    const { data: rounds, error: roundsError } = await supabase
      .from('monthly_rounds')
      .select('id')
      .eq('chit_id', chitId);
    if (roundsError) throw roundsError;

    if (!rounds || rounds.length === 0) return [];
    const roundIds = rounds.map((r: any) => r.id);

    const { data: auctions, error: auctionsError } = await supabase
      .from('auctions')
      .select('winner_member_id')
      .in('round_id', roundIds);
    if (auctionsError) throw auctionsError;

    const winners = new Set<number>();
    (auctions || []).forEach((a: any) => winners.add(a.winner_member_id));
    return Array.from(winners);
  }
}
