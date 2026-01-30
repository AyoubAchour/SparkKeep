import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useMutation } from 'convex/react';
import { getOutboxItems, removeOutboxByLocalId, markIdeaSynced, getServerIdByLocalId, incrementOutboxAttempt } from './localdb';

export function useOutboxSync() {
  const createProject = useMutation<any>('ideas:createProject' as any);
  const createFeature = useMutation<any>('ideas:createFeature' as any);
  const updateStatus = useMutation<any>('ideas:updateStatus' as any);
  const archiveIdea = useMutation<any>('ideas:archiveIdea' as any);
  const deleteIdea = useMutation<any>('ideas:deleteIdea' as any);

  useEffect(() => {
    let mounted = true;

    async function flush() {
      const items = await getOutboxItems();
      for (const item of items) {
        if (!mounted) break;
        try {
          const payload = JSON.parse(item.payload);
          if (item.action === 'createProject') {
            const serverId = await createProject({ content: payload.content });
            await markIdeaSynced(payload.localId, serverId);
            await removeOutboxByLocalId(payload.localId);
          } else if (item.action === 'createFeature') {
            const parentServerId = payload.parentProjectServerId ?? (payload.parentProjectLocalId ? await getServerIdByLocalId(payload.parentProjectLocalId) : undefined);
            const serverId = await createFeature({ content: payload.content, parentProjectId: parentServerId ?? undefined, status: payload.status ?? 'INBOX' });
            await markIdeaSynced(payload.localId, serverId);
            await removeOutboxByLocalId(payload.localId);
          } else if (item.action === 'updateStatus') {
            const serverId = payload.serverId ?? (await getServerIdByLocalId(payload.localId));
            if (serverId) {
              await updateStatus({ id: serverId, status: payload.status });
              await removeOutboxByLocalId(payload.localId);
            }
          } else if (item.action === 'archiveIdea') {
            const serverId = payload.serverId ?? (await getServerIdByLocalId(payload.localId));
            if (serverId) {
              await archiveIdea({ id: serverId });
              await removeOutboxByLocalId(payload.localId);
            }
          } else if (item.action === 'deleteIdea') {
            const serverId = payload.serverId ?? (await getServerIdByLocalId(payload.localId));
            if (serverId) {
              await deleteIdea({ id: serverId });
              await removeOutboxByLocalId(payload.localId);
            }
          }
        } catch (e: any) {
          try {
            const parsed = JSON.parse(item.payload);
            if (parsed?.localId) {
              await incrementOutboxAttempt(parsed.localId, e?.message ?? 'Sync failed');
            }
          } catch {
            // ignore
          }
          // keep in outbox; will retry next time
        }
      }
    }

    // Expose manual flush trigger for UI retry actions
    _flushOutboxRef = flush;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flush();
    });

    // initial flush on mount
    flush();

    return () => {
      mounted = false;
      sub.remove();
      // Clear exposed flush trigger
      _flushOutboxRef = null;
    };
  }, [createProject, createFeature]);
}

let _flushOutboxRef: null | (() => Promise<void>) = null;

export async function triggerOutboxFlush(): Promise<void> {
  if (_flushOutboxRef) {
    await _flushOutboxRef();
  }
}
