import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useMutation } from 'convex/react';
import { 
  getOutboxItems, 
  removeOutboxByLocalId, 
  markIdeaSynced, 
  getServerIdByLocalId, 
  incrementOutboxAttempt,
  removeOutboxById
} from './localdb';
import { OutboxItem } from './types';

// Sync configuration
const RETRY_DELAYS = [2000, 5000, 10000, 30000]; // Backoff: 2s, 5s, 10s, 30s
const MAX_RETRY_ATTEMPTS = 10;

// Global state for sync service
let isOnline = true;
let isSyncing = false;
let retryTimeoutId: NodeJS.Timeout | null = null;

// Exposed for manual triggers
let _syncNowFn: (() => Promise<void>) | null = null;

/**
 * Main sync hook - manages connectivity and outbox flushing
 */
export function useSyncService() {
  const createProject = useMutation<any>('ideas:createProject' as any);
  const createFeature = useMutation<any>('ideas:createFeature' as any);
  const updateStatus = useMutation<any>('ideas:updateStatus' as any);
  const archiveIdea = useMutation<any>('ideas:archiveIdea' as any);
  const deleteIdea = useMutation<any>('ideas:deleteIdea' as any);

  const mountedRef = useRef(true);
  const currentRetryIndex = useRef(0);

  /**
   * Process a single outbox item
   */
  const processItem = useCallback(async (item: OutboxItem): Promise<boolean> => {
    try {
      const payload = JSON.parse(item.payload);
      
      if (item.action === 'createProject') {
        const serverId = await createProject({ content: payload.content });
        await markIdeaSynced(payload.localId, serverId);
        await removeOutboxByLocalId(payload.localId);
        return true;
      } 
      
      if (item.action === 'createFeature') {
        const parentServerId = payload.parentProjectServerId ?? 
          (payload.parentProjectLocalId ? await getServerIdByLocalId(payload.parentProjectLocalId) : undefined);
        const serverId = await createFeature({ 
          content: payload.content, 
          parentProjectId: parentServerId ?? undefined, 
          status: payload.status ?? 'INBOX' 
        });
        await markIdeaSynced(payload.localId, serverId);
        await removeOutboxByLocalId(payload.localId);
        return true;
      } 
      
      if (item.action === 'updateStatus') {
        const serverId = payload.serverId ?? (await getServerIdByLocalId(payload.localId));
        if (serverId) {
          await updateStatus({ id: serverId, status: payload.status });
          await removeOutboxByLocalId(payload.localId);
          return true;
        } else {
          // No serverId - item was never synced, remove from outbox (local update is enough)
          console.log(`[Sync] updateStatus: No serverId for ${payload.localId}, removing from outbox`);
          await removeOutboxById(item.id);
          return true;
        }
      } 
      
      if (item.action === 'archiveIdea') {
        const serverId = payload.serverId ?? (await getServerIdByLocalId(payload.localId));
        if (serverId) {
          await archiveIdea({ id: serverId });
          await removeOutboxByLocalId(payload.localId);
          return true;
        } else {
          // No serverId - item was never synced, remove from outbox
          console.log(`[Sync] archiveIdea: No serverId for ${payload.localId}, removing from outbox`);
          await removeOutboxById(item.id);
          return true;
        }
      } 
      
      if (item.action === 'deleteIdea') {
        const serverId = payload.serverId ?? (await getServerIdByLocalId(payload.localId));
        if (serverId) {
          await deleteIdea({ id: serverId });
          await removeOutboxByLocalId(payload.localId);
          return true;
        } else {
          // No serverId - item was never synced, just remove from outbox
          // Local delete already happened
          console.log(`[Sync] deleteIdea: No serverId for ${payload.localId}, removing from outbox`);
          await removeOutboxById(item.id);
          return true;
        }
      }

      return false;
    } catch (e: any) {
      console.error(`[Sync] Failed to process ${item.action}:`, e?.message);
      
      // Increment attempt count
      try {
        const parsed = JSON.parse(item.payload);
        if (parsed?.localId) {
          await incrementOutboxAttempt(parsed.localId, e?.message ?? 'Sync failed');
        }
      } catch {
        // ignore parsing errors
      }

      // If max retries exceeded, remove from outbox to prevent infinite loops
      if (item.attemptCount >= MAX_RETRY_ATTEMPTS) {
        console.log(`[Sync] Max retries exceeded for ${item.action}, removing from outbox`);
        await removeOutboxById(item.id);
        return true;
      }

      return false;
    }
  }, [createProject, createFeature, updateStatus, archiveIdea, deleteIdea]);

  /**
   * Flush entire outbox
   */
  const flushOutbox = useCallback(async () => {
    if (!mountedRef.current || isSyncing || !isOnline) return;

    isSyncing = true;
    console.log('[Sync] Starting outbox flush...');

    try {
      const items = await getOutboxItems();
      
      if (items.length === 0) {
        console.log('[Sync] Outbox empty');
        currentRetryIndex.current = 0; // Reset backoff
        isSyncing = false;
        return;
      }

      console.log(`[Sync] Processing ${items.length} items...`);
      let anyFailed = false;

      for (const item of items) {
        if (!mountedRef.current || !isOnline) break;
        
        const success = await processItem(item);
        if (!success) {
          anyFailed = true;
        }
      }

      // If some items failed and we're still online, schedule retry
      if (anyFailed && isOnline && mountedRef.current) {
        const delay = RETRY_DELAYS[Math.min(currentRetryIndex.current, RETRY_DELAYS.length - 1)];
        currentRetryIndex.current++;
        console.log(`[Sync] Some items failed, retrying in ${delay}ms...`);
        
        if (retryTimeoutId) clearTimeout(retryTimeoutId);
        retryTimeoutId = setTimeout(() => {
          if (mountedRef.current && isOnline) {
            flushOutbox();
          }
        }, delay);
      } else {
        currentRetryIndex.current = 0; // Reset backoff on success
      }
    } finally {
      isSyncing = false;
    }
  }, [processItem]);

  /**
   * Immediate sync attempt for new actions
   */
  const syncNow = useCallback(async () => {
    if (!isOnline) {
      console.log('[Sync] Offline, action queued for later');
      return;
    }
    
    // Small delay to ensure outbox item is written
    setTimeout(() => {
      flushOutbox();
    }, 100);
  }, [flushOutbox]);

  // Expose syncNow globally
  useEffect(() => {
    _syncNowFn = syncNow;
    return () => {
      _syncNowFn = null;
    };
  }, [syncNow]);

  // Setup connectivity listener
  useEffect(() => {
    mountedRef.current = true;

    const handleConnectivityChange = (state: NetInfoState) => {
      const wasOffline = !isOnline;
      isOnline = state.isConnected ?? false;
      
      console.log(`[Sync] Connectivity changed: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      
      // If we just came online, flush outbox
      if (wasOffline && isOnline && mountedRef.current) {
        console.log('[Sync] Back online, flushing outbox...');
        currentRetryIndex.current = 0; // Reset backoff
        flushOutbox();
      }
    };

    // Subscribe to connectivity changes
    const unsubscribeNetInfo = NetInfo.addEventListener(handleConnectivityChange);

    // Check initial state
    NetInfo.fetch().then(handleConnectivityChange);

    // Also flush on app becoming active
    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === 'active' && isOnline && mountedRef.current) {
        console.log('[Sync] App became active, flushing outbox...');
        flushOutbox();
      }
    };

    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    // Initial flush
    flushOutbox();

    return () => {
      mountedRef.current = false;
      unsubscribeNetInfo();
      appStateSub.remove();
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
    };
  }, [flushOutbox]);

  return { syncNow, isOnline: () => isOnline };
}

/**
 * Trigger immediate sync from anywhere in the app
 */
export async function triggerSync(): Promise<void> {
  if (_syncNowFn) {
    await _syncNowFn();
  }
}

/**
 * Check if currently online
 */
export function checkOnline(): boolean {
  return isOnline;
}
