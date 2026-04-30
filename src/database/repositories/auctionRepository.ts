import { SQLiteDatabase } from 'expo-sqlite';
import { Auction } from '../types';

export class AuctionRepository {
  constructor(private db: SQLiteDatabase) {}

  async recordAuction(data: Omit<Auction, 'id' | 'created_at'>): Promise<number> {
    const result = await this.db.runAsync(
      `INSERT INTO auctions (round_id, winner_member_id, commission_amount, payout_amount, dividend_per_member, effective_contribution, auction_number) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.round_id, data.winner_member_id, data.commission_amount, data.payout_amount, data.dividend_per_member, data.effective_contribution, data.auction_number]
    );
    return result.lastInsertRowId;
  }

  async getAuctionsByRound(roundId: number): Promise<Auction[]> {
    return await this.db.getAllAsync<Auction>(
      "SELECT * FROM auctions WHERE round_id = ?",
      [roundId]
    );
  }

  async getAuctionHistory(chitId: number): Promise<(Auction & { winner_name: string, month_number: number })[]> {
    return await this.db.getAllAsync<Auction & { winner_name: string, month_number: number }>(
      `SELECT a.*, m.name as winner_name, r.month_number 
       FROM auctions a
       JOIN monthly_rounds r ON a.round_id = r.id
       JOIN members m ON a.winner_member_id = m.id
       WHERE r.chit_id = ?
       ORDER BY r.month_number ASC, a.auction_number ASC`,
      [chitId]
    );
  }

  async getCumulativeCommission(chitId: number): Promise<number> {
    const result = await this.db.getFirstAsync<{ total: number }>(
      `SELECT SUM(commission_amount) as total 
       FROM auctions a
       JOIN monthly_rounds r ON a.round_id = r.id
       WHERE r.chit_id = ?`,
      [chitId]
    );
    return result?.total || 0;
  }

  async getWinners(chitId: number): Promise<number[]> {
    const results = await this.db.getAllAsync<{ winner_member_id: number }>(
      `SELECT DISTINCT winner_member_id 
       FROM auctions a
       JOIN monthly_rounds r ON a.round_id = r.id
       WHERE r.chit_id = ?`,
      [chitId]
    );
    return results.map(r => r.winner_member_id);
  }
}
