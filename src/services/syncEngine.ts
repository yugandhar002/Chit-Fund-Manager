import { supabase } from '../database/supabase';
import { LocalDatabase, SyncAction } from '../database/localDb';

class SyncEngineManager {
  private syncing = false;

  /**
   * Pushes all pending local changes in the queue to Supabase.
   */
  async pushQueue(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    console.log('SyncEngine: Starting push cycle...');

    try {
      await LocalDatabase.init();
      const queue = [...LocalDatabase.getQueue()]; // Copy queue to prevent mutation issues

      for (const action of queue) {
        let success = false;
        console.log(`SyncEngine: Processing action ${action.action} on ${action.table} for ID ${action.recordId}`);

        try {
          if (action.action === 'insert') {
            // Using upsert to avoid conflicts on retries
            const { error } = await supabase
              .from(action.table)
              .upsert(action.data);
            if (!error) success = true;
            else console.error('Supabase insert error:', error);
          } 
          else if (action.action === 'update') {
            const { error } = await supabase
              .from(action.table)
              .update(action.data)
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
}

export const SyncEngine = new SyncEngineManager();
