import { supabase } from '../database/supabase';
import { LocalDatabase, SyncAction } from '../database/localDb';

class SyncEngineManager {
  private syncing = false;
  private listeners: Array<() => void> = [];
  private realtimeChannel: any = null;

  subscribe(callback: () => void) {
    this.listeners.push(callback);
    return () => this.unsubscribe(callback);
  }

  unsubscribe(callback: () => void) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  private notifyListeners() {
    console.log(`SyncEngine: Notifying ${this.listeners.length} listeners of data update.`);
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('SyncEngine listener error:', err);
      }
    });
  }

  /**
   * Pushes all pending local changes in the queue to Supabase.
   */
  async pushQueue(): Promise<void> {
    if (!supabase) {
      console.warn('SyncEngine: Supabase client not initialized. Push cycle aborted.');
      return;
    }
    if (this.syncing) return;
    this.syncing = true;
    console.log('SyncEngine: Starting push cycle...');

    try {
      await LocalDatabase.init();
      const queue = [...LocalDatabase.getQueue()]; // Copy queue to prevent mutation issues

      for (const action of queue) {
        let success = false;
        console.log(`SyncEngine: Processing action ${action.action} on ${action.table} for ID ${action.recordId}`);

        // Prepare raw payload to push, filtering out created_at/updated_at for payment_transactions
        let dataToPush = action.data ? { ...action.data } : undefined;
        if (dataToPush && action.table === 'payment_transactions') {
          delete dataToPush.created_at;
          delete dataToPush.updated_at;
        }

        try {
          if (action.action === 'insert') {
            // Using upsert to avoid conflicts on retries
            const { error } = await supabase
              .from(action.table)
              .upsert(dataToPush);
            if (!error) success = true;
            else console.error('Supabase insert error:', error);
          } 
          else if (action.action === 'update') {
            const { error } = await supabase
              .from(action.table)
              .update(dataToPush)
              .eq('id', action.recordId);
            if (!error) success = true;
            else console.error('Supabase update error:', error);
          } 
          else if (action.action === 'delete') {
            const { error } = await supabase
              .from(action.table)
              .delete()
              .eq('id', action.recordId);
            if (!error) success = true;
            else console.error('Supabase delete error:', error);
          }
        } catch (dbErr) {
          console.error(`SyncEngine: Supabase connection failed for action ${action.id}:`, dbErr);
        }

        if (success) {
          await LocalDatabase.dequeue(action.id);
          console.log(`SyncEngine: Action ${action.id} synced and dequeued.`);
        } else {
          // If a request failed (e.g. network timeout/offline), abort and retry on the next cycle
          console.log('SyncEngine: Network offline or sync error encountered. Aborting push cycle.');
          break;
        }
      }
    } catch (e) {
      console.error('SyncEngine: Push loop failed:', e);
    } finally {
      this.syncing = false;
      console.log('SyncEngine: Push cycle complete.');
    }
  }

  /**
   * Pulls all table data from Supabase and merges it into local storage.
   */
  async pullFromCloud(): Promise<void> {
    if (!supabase) {
      console.warn('SyncEngine: Supabase client not initialized. Pull cycle aborted.');
      return;
    }
    console.log('SyncEngine: Initiating pull from cloud...');
    try {
      await LocalDatabase.init();
      
      const tables = [
        'chits',
        'members',
        'monthly_rounds',
        'auctions',
        'payments',
        'payment_transactions',
      ];

      // Fetch all tables from cloud in parallel
      const pullPromises = tables.map(table => supabase.from(table).select('*'));
      const results = await Promise.all(pullPromises);

      const queue = LocalDatabase.getQueue();

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const { data: cloudRows, error } = results[i];

        if (error) {
          console.error(`SyncEngine: Failed to pull table ${table} from Supabase:`, error);
          continue;
        }

        if (!cloudRows) continue;

        // Keep local records that have pending sync queue updates/inserts/deletions so we do not overwrite them
        const pendingActions = queue.filter(q => q.table === table);
        const pendingIds = new Set(pendingActions.map(q => q.recordId));
        const pendingDeleteIds = new Set(pendingActions.filter(q => q.action === 'delete').map(q => q.recordId));

        const localRows = LocalDatabase.getTable<any>(table);
        const localPendingRecords = localRows.filter(r => pendingIds.has(r.id));

        // Filter out records from cloud that are locally deleted in queue
        const mergedRows = cloudRows.filter((r: any) => !pendingIds.has(r.id) && !pendingDeleteIds.has(r.id));

        // Combine non-mutated cloud records with our locally edited/unsynced ones
        const finalRows = [...mergedRows, ...localPendingRecords];

        // Replace local table state with the consolidated fresh dataset
        await LocalDatabase.replaceTableLocal(table, finalRows);
      }

      console.log('SyncEngine: Pull and merge fully succeeded.');
      this.notifyListeners();
    } catch (e) {
      console.error('SyncEngine: Pull from cloud failed:', e);
    }
  }

  /**
   * Helper that pulls from cloud, then pushes any local queue entries in the background.
   */
  async syncAll(): Promise<void> {
    // 1. Push any local writes first
    await this.pushQueue();
    // 2. Fetch fresh cloud data
    await this.pullFromCloud();
  }

  startRealtimeSubscription() {
    if (!supabase) {
      console.warn('SyncEngine: Supabase client not initialized. Realtime subscription aborted.');
      return;
    }
    if (this.realtimeChannel) {
      console.log('SyncEngine: Realtime subscription already active.');
      return;
    }

    console.log('SyncEngine: Initializing Supabase Realtime subscription...');
    
    this.realtimeChannel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
        },
        async (payload: any) => {
          console.log('SyncEngine: Received realtime DB change payload:', payload);
          // We pull fresh cloud data and merge it locally
          await this.pullFromCloud();
        }
      )
      .subscribe((status: any) => {
        console.log(`SyncEngine: Realtime subscription status: ${status}`);
      });
  }

  stopRealtimeSubscription() {
    if (!supabase) return;
    if (this.realtimeChannel) {
      console.log('SyncEngine: Stopping Supabase Realtime subscription...');
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }
}

export const SyncEngine = new SyncEngineManager();
