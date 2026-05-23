import { LocalDatabase } from '../localDb';
import { Auction, MonthlyRound, Member } from '../types';

export class AuctionRepository {
  async recordAuction(data: Omit<Auction, 'id' | 'created_at'>): Promise<number> {
    const result = await LocalDatabase.insert<Auction>('auctions', data);
    return result.id;
  }

  async getAuctionsByRound(roundId: number): Promise<Auction[]> {
    const rows = LocalDatabase.getTable<Auction>('auctions');
    return rows.filter(a => a.round_id === roundId);
  }

  async getAuctionHistory(chitId: number): Promise<(Auction & { winner_name: string, month_number: number })[]> {
    // 1. Get rounds map for this chit
    const rounds = LocalDatabase.getTable<MonthlyRound>('monthly_rounds')
      .filter(r => r.chit_id === chitId);
    
    if (rounds.length === 0) return [];
    
    const roundIds = new Set(rounds.map(r => r.id));
    const roundMap = new Map(rounds.map(r => [r.id, r.month_number]));

    // 2. Get auctions for these rounds
    const auctions = LocalDatabase.getTable<Auction>('auctions')
      .filter(a => roundIds.has(a.round_id));

    // 3. Map auction with winner name and month number
    const history = auctions.map(a => {
      const member = LocalDatabase.getById<Member>('members', a.winner_member_id);
      return {
        ...a,
        winner_name: member?.name || 'Unknown',
        month_number: roundMap.get(a.round_id) || 0
      };
    });

    // 4. Sort by month_number then auction_number
    return history.sort((a, b) => {
      if (a.month_number === b.month_number) {
        return a.auction_number - b.auction_number;
      }
      return a.month_number - b.month_number;
    });
  }

  async getCumulativeCommission(chitId: number): Promise<number> {
    const roundIds = new Set(
      LocalDatabase.getTable<MonthlyRound>('monthly_rounds')
        .filter(r => r.chit_id === chitId)
        .map(r => r.id)
    );

    if (roundIds.size === 0) return 0;

    const auctions = LocalDatabase.getTable<Auction>('auctions')
      .filter(a => roundIds.has(a.round_id));

    return auctions.reduce((sum, a) => sum + (a.commission_amount || 0), 0);
  }

  async getWinners(chitId: number): Promise<number[]> {
    const roundIds = new Set(
      LocalDatabase.getTable<MonthlyRound>('monthly_rounds')
        .filter(r => r.chit_id === chitId)
        .map(r => r.id)
    );

    if (roundIds.size === 0) return [];

    const auctions = LocalDatabase.getTable<Auction>('auctions')
      .filter(a => roundIds.has(a.round_id));

    const winners = new Set<number>();
    auctions.forEach(a => winners.add(a.winner_member_id));
    return Array.from(winners);
  }
}
