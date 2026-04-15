import { SQLiteDatabase } from 'expo-sqlite';
import { Member } from '../types';

export class MemberRepository {
  constructor(private db: SQLiteDatabase) {}

  async addMember(data: Omit<Member, 'id' | 'created_at'>): Promise<number> {
    const result = await this.db.runAsync(
      `INSERT INTO members (chit_id, name, phone, address, is_organizer, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.chit_id, data.name, data.phone || null, data.address || null, data.is_organizer, data.status]
    );
    return result.lastInsertRowId;
  }

  async getMembersByChit(chitId: number): Promise<Member[]> {
    return await this.db.getAllAsync<Member>(
      "SELECT * FROM members WHERE chit_id = ? ORDER BY is_organizer DESC, name ASC",
      [chitId]
    );
  }

  async updateMember(id: number, data: Partial<Omit<Member, 'id' | 'chit_id' | 'created_at'>>): Promise<void> {
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];
    await this.db.runAsync(`UPDATE members SET ${fields} WHERE id = ?`, values);
  }

  async getAvailableBidders(chitId: number): Promise<Member[]> {
    // Get members who haven't won an auction yet in this chit
    return await this.db.getAllAsync<Member>(
      `SELECT * FROM members 
       WHERE chit_id = ? AND is_organizer = 0 AND id NOT IN (
         SELECT winner_member_id FROM auctions 
         JOIN monthly_rounds ON auctions.round_id = monthly_rounds.id 
         WHERE monthly_rounds.chit_id = ?
       )
       ORDER BY name ASC`,
      [chitId, chitId]
    );
  }
}
