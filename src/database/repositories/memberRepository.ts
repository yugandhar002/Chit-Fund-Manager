import { LocalDatabase } from '../localDb';
import { Member, MonthlyRound, Auction } from '../types';

export class MemberRepository {
  async addMember(data: Omit<Member, 'id' | 'created_at'>): Promise<number> {
    const result = await LocalDatabase.insert<Member>('members', data);
    return result.id;
  }

  async getMembersByChit(chitId: number): Promise<Member[]> {
    const rows = LocalDatabase.getTable<Member>('members');
    return rows
      .filter(r => r.chit_id === chitId)
      .sort((a, b) => {
        // Sort by is_organizer desc, then name asc
        if (b.is_organizer !== a.is_organizer) {
          return b.is_organizer - a.is_organizer;
        }
        return a.name.localeCompare(b.name);
      });
  }

  async getMemberById(id: number): Promise<Member | null> {
    return LocalDatabase.getById<Member>('members', id);
  }

  async updateMember(id: number, data: Partial<Omit<Member, 'id' | 'chit_id' | 'created_at'>>): Promise<void> {
    await LocalDatabase.update<Member>('members', id, data);
  }

  async deleteMember(id: number): Promise<void> {
    await LocalDatabase.delete('members', id);
  }

  async getAvailableBidders(chitId: number): Promise<Member[]> {
    // 1. Get all round ids for this chit
    const rounds = LocalDatabase.getTable<MonthlyRound>('monthly_rounds')
      .filter(r => r.chit_id === chitId);
    
    const roundIds = new Set(rounds.map(r => r.id));

    // 2. Get all winner member ids from auctions
    const auctions = LocalDatabase.getTable<Auction>('auctions')
      .filter(a => roundIds.has(a.round_id));
    
    const winnerIds = new Set(auctions.map(a => a.winner_member_id));

    // 3. Get non-winners members of this chit
    const members = LocalDatabase.getTable<Member>('members')
      .filter(m => m.chit_id === chitId && m.is_organizer === 0 && !winnerIds.has(m.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    return members;
  }
}
