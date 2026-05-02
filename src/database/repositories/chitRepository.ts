import { supabase } from '../supabase';
import { Chit } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class ChitRepository {
  async createChit(data: Omit<Chit, 'id' | 'created_at'>): Promise<number> {
    const { data: result, error } = await supabase
      .from('chits')
      .insert([data])
      .select('id')
      .single();

    if (error) throw error;
    return result.id;
  }

  async getAllActiveChits(): Promise<Chit[]> {
    const { data, error } = await supabase
      .from('chits')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getActiveChit(): Promise<Chit | null> {
    try {
      const selectedIdStr = await AsyncStorage.getItem('selectedChitId');
      
      if (selectedIdStr) {
        const { data, error } = await supabase
          .from('chits')
          .select('*')
          .eq('id', parseInt(selectedIdStr))
          .single();
          
        if (data) return data;
        // If it fails (maybe deleted), fall through to default behavior
      }
    } catch (e) {
      console.log('AsyncStorage error:', e);
    }

    // Default: return most recent active chit
    const { data, error } = await supabase
      .from('chits')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    // Save this as the default if we found one
    if (data) {
      await AsyncStorage.setItem('selectedChitId', data.id.toString());
    }
    
    return data || null;
  }

  async updateChitStatus(id: number, status: 'active' | 'completed'): Promise<void> {
    const { error } = await supabase
      .from('chits')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
  }

  async deleteChit(id: number): Promise<void> {
    const { error } = await supabase
      .from('chits')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
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
    const { data, error } = await supabase
      .from('chits')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }
}
