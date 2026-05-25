# Debug Session: CFM_Sync_Issues

## Symptom
When transactions or payments are added on one phone (e.g., father's phone), they do not appear on another phone (e.g., the user's phone). Nothing updates on the screen in real-time.

**When:** Occurs anytime multi-device updates happen.
**Expected:** The app should receive and show remote updates automatically on all screens without needing manual app restarts or manual navigation.
**Actual:** Screen does not update and is stale until a manual tab navigation/focus to Dashboard happens (which runs the sync) or the app is restarted. Other screens like Payments and Auctions do not trigger sync or react to background sync updates.

## Hypotheses

| # | Hypothesis | Likelihood | Status |
|---|------------|------------|--------|
| 1 | Sync is only called on Dashboard Focus, meaning other screens never trigger sync. | 95% | CONFIRMED |
| 2 | No Supabase Realtime subscription is implemented, so database changes from other devices are never pushed to the client in real-time. | 95% | CONFIRMED |
| 3 | No periodic polling exists, so the client is static when the app is in the foreground. | 90% | CONFIRMED |
| 4 | Payments and Auctions screens use local `loadData` with React state and do not listen to database/sync change events, so background syncs don't refresh their UI. | 95% | CONFIRMED |

## Attempts

### Attempt 1
**Testing:** H1, H2, H3, H4 — Investigation of the codebase sync logic and event routing
**Action:** Analyzed code usage of `SyncEngine`, `supabase` subscriptions, and screen-specific state management.
**Result:** 
- `SyncEngine.syncAll()` is only called in `app/(tabs)/index.tsx`. Other screens never invoke it.
- No `supabase.channel()` calls exist, meaning there are no Realtime subscriptions.
- There is no polling loop running when the app is in the foreground.
- Screens (Auction, Payments) load data into local React state on focus and have no mechanism to react to database cache changes.
**Conclusion:** CONFIRMED ALL HYPOTHESES. We need a multi-layered Real-time Sync and Event-driven UI update system.


