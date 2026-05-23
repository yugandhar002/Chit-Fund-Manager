import { LocalDatabase } from '../localDb';
import { Chit } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class ChitRepository {
  async createChit(data: Omit<Chit, 'id' | 'created_at'>): Promise<number> {
    const result = await LocalDatabase.insert<Chit>('chits', data);
    return result.id;
  }

  async getAllActiveChits(): Promise<Chit[]> {
    const rows = LocalDatabase.getTable<Chit>('chits');
    return rows
      .filter(r => r.status === 'active')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getActiveChit(): Promise<Chit | null> {
    try {
      const selectedIdStr = await AsyncStorage.getItem('selectedChitId');
      
      if (selectedIdStr) {
        const chit = LocalDatabase.getById<Chit>('chits', parseInt(selectedIdStr));
        if (chit) return chit;
      }
    } catch (e) {
      console.log('AsyncStorage error:', e);
    }

    // Default: return most recent active chit
    const active = LocalDatabase.getTable<Chit>('chits')
      .filter(r => r.status === 'active')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (active.length > 0) {
      const first = active[0];
      await AsyncStorage.setItem('selectedChitId', first.id.toString());
      return first;
    }
    
    return null;
  }

  async updateChitStatus(id: number, status: 'active' | 'completed'): Promise<void> {
    await LocalDatabase.update<Chit>('chits', id, { status });
  }

  async deleteChit(id: number): Promise<void> {
    await LocalDatabase.delete('chits', id);
    
    // Clear the selected id from AsyncStorage if we're deleting the current one
    try {
      const selectedIdStr = await AsyncStorage.getItem('selectedChitId');
      if (selectedIdStr === id.toString()) {
        await AsyncStorage.removeItem('selectedChitId');
      }
    } catch (e) {
      console.log('AsyncStorage error:', e);
    }
  }

  async getChitById(id: number): Promise<Chit | null> {
    return LocalDatabase.getById<Chit>('chits', id);
  }
}
