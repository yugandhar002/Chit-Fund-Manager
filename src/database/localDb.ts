import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SyncAction {
  id: string;
  action: 'insert' | 'update' | 'delete';
  table: string;
  recordId: number;
  data?: any;
}

class LocalDatabaseManager {
  private cache: Record<string, any[]> = {
    chits: [],
    members: [],
    monthly_rounds: [],
    auctions: [],
    payments: [],
    payment_transactions: [],
  };
  private queue: SyncAction[] = [];
  private initialized = false;

  async init() {
    if (this.initialized) return;
    try {
      const keys = Object.keys(this.cache);
      const storedData = await AsyncStorage.multiGet(keys.map(k => `db_${k}`));
      
      for (const [key, value] of storedData) {
        const table = key.replace('db_', '');
        if (value) {
          this.cache[table] = JSON.parse(value);
        } else {
          this.cache[table] = [];
        }
      }

      const storedQueue = await AsyncStorage.getItem('db_sync_queue');
      this.queue = storedQueue ? JSON.parse(storedQueue) : [];
      this.initialized = true;
      console.log('LocalDatabase: Cache fully loaded from AsyncStorage.');
    } catch (e) {
      console.error('LocalDatabase init failed:', e);
      // Fallback: initialize empty
      this.initialized = true;
    }
  }

  private async saveTable(table: string) {
    try {
      await AsyncStorage.setItem(`db_${table}`, JSON.stringify(this.cache[table]));
    } catch (e) {
      console.error(`Failed to save table ${table} to AsyncStorage:`, e);
    }
  }

  private async saveQueue() {
    try {
      await AsyncStorage.setItem('db_sync_queue', JSON.stringify(this.queue));
    } catch (e) {
      console.error('Failed to save sync queue:', e);
    }
  }

  // --- Read Operations ---
  getTable<T>(table: string): T[] {
    if (!this.initialized) {
      console.warn(`LocalDatabase: Querying table '${table}' before initialization.`);
    }
    return (this.cache[table] || []) as T[];
  }

  getById<T extends { id: number }>(table: string, id: number): T | null {
    const rows = this.getTable<T>(table);
    return rows.find(r => r.id === id) || null;
  }

  // --- Mutation Operations ---
  async insert<T extends { id: number; created_at?: string; updated_at?: string }>(
    table: string, 
    data: Omit<T, 'id' | 'created_at' | 'updated_at'>
  ): Promise<T> {
    await this.init(); // Safeguard

    // Generate a unique high-precision timestamp-based integer ID to avoid collisions
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const nowIso = new Date().toISOString();

    const newRecord = {
      ...data,
      id,
      created_at: nowIso,
      updated_at: nowIso,
    } as any as T;

    this.cache[table].push(newRecord);
    await this.saveTable(table);

    // Enqueue background cloud synchronization action
    const actionId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.queue.push({
      id: actionId,
      action: 'insert',
      table,
      recordId: id,
      data: newRecord,
    });
    await this.saveQueue();

    return newRecord;
  }

  async update<T extends { id: number; updated_at?: string }>(
    table: string, 
    id: number, 
    data: Partial<Omit<T, 'id' | 'created_at'>>
  ): Promise<T | null> {
    await this.init(); // Safeguard

    const rows = this.cache[table] || [];
    const index = rows.findIndex(r => r.id === id);
    if (index === -1) return null;

    const nowIso = new Date().toISOString();
    const updatedRecord = {
      ...rows[index],
      ...data,
      updated_at: nowIso,
    };

    rows[index] = updatedRecord;
    await this.saveTable(table);

    // Enqueue update sync event
    const actionId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.queue.push({
      id: actionId,
      action: 'update',
      table,
      recordId: id,
      data,
    });
    await this.saveQueue();

    return updatedRecord as T;
  }

  async delete(table: string, id: number): Promise<boolean> {
    await this.init(); // Safeguard

    const rows = this.cache[table] || [];
    const initialLen = rows.length;
    this.cache[table] = rows.filter(r => r.id !== id);
    
    if (this.cache[table].length === initialLen) return false;

    await this.saveTable(table);

    // Enqueue delete sync event
    const actionId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.queue.push({
      id: actionId,
      action: 'delete',
      table,
      recordId: id,
    });
    await this.saveQueue();

    return true;
  }

  // --- Cloud Syncing Helper API ---
  getQueue(): SyncAction[] {
    return this.queue;
  }

  async dequeue(actionId: string) {
    this.queue = this.queue.filter(a => a.id !== actionId);
    await this.saveQueue();
  }

  async replaceTableLocal(table: string, data: any[]) {
    this.cache[table] = data;
    await this.saveTable(table);
  }

  async clearAll() {
    this.cache = {
      chits: [],
      members: [],
      monthly_rounds: [],
      auctions: [],
      payments: [],
      payment_transactions: [],
    };
    this.queue = [];
    const keys = Object.keys(this.cache);
    await AsyncStorage.multiRemove(keys.map(k => `db_${k}`));
    await AsyncStorage.removeItem('db_sync_queue');
  }
}

export const LocalDatabase = new LocalDatabaseManager();
