import { SQLiteDatabase, openDatabaseSync, SQLiteBindParams } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { IdeaRecord, OutboxItem, IdeaType, IdeaStatus } from './types';

export const db: SQLiteDatabase = openDatabaseSync('sparkkeep.db');

export async function initDb(): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ideas (
      localId TEXT PRIMARY KEY NOT NULL,
      serverId TEXT,
      content TEXT NOT NULL,
      type TEXT NOT NULL,
      parentProjectLocalId TEXT,
      parentProjectServerId TEXT,
      status TEXT NOT NULL,
      archived INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      attemptCount INTEGER NOT NULL,
      lastError TEXT
    );
  `);
}

export async function insertIdeaLocal(params: {
  content: string;
  type: IdeaType;
  parentProjectLocalId?: string | null;
  status?: IdeaStatus;
}): Promise<IdeaRecord> {
  const localId = Crypto.randomUUID();
  const now = Date.now();
  const status: IdeaStatus = params.status ?? (params.type === 'PROJECT' ? 'BACKLOG' : 'INBOX');
  const record: IdeaRecord = {
    localId,
    serverId: null,
    content: params.content,
    type: params.type,
    parentProjectLocalId: params.parentProjectLocalId ?? null,
    parentProjectServerId: null,
    status,
    archived: 0,
    createdAt: now,
    updatedAt: now,
  };
  const params1: SQLiteBindParams = {
    $localId: record.localId,
    $serverId: record.serverId ?? null,
    $content: record.content,
    $type: record.type,
    $parentProjectLocalId: record.parentProjectLocalId ?? null,
    $parentProjectServerId: record.parentProjectServerId ?? null,
    $status: record.status,
    $archived: record.archived,
    $createdAt: record.createdAt,
    $updatedAt: record.updatedAt,
  };
  await db.runAsync(
    `INSERT INTO ideas (localId, serverId, content, type, parentProjectLocalId, parentProjectServerId, status, archived, createdAt, updatedAt)
     VALUES ($localId, $serverId, $content, $type, $parentProjectLocalId, $parentProjectServerId, $status, $archived, $createdAt, $updatedAt)`,
    params1
  );
  return record;
}

export async function enqueueOutbox(action: OutboxItem['action'], payload: object): Promise<OutboxItem> {
  const id = Crypto.randomUUID();
  const createdAt = Date.now();
  const item: OutboxItem = {
    id,
    action,
    payload: JSON.stringify(payload),
    createdAt,
    attemptCount: 0,
    lastError: null,
  };
  const params2: SQLiteBindParams = {
    $id: item.id,
    $action: item.action,
    $payload: item.payload,
    $createdAt: item.createdAt,
    $attemptCount: item.attemptCount,
    $lastError: item.lastError ?? null,
  };
  await db.runAsync(
    `INSERT INTO outbox (id, action, payload, createdAt, attemptCount, lastError)
     VALUES ($id, $action, $payload, $createdAt, $attemptCount, $lastError)`,
    params2
  );
  return item;
}

export async function markIdeaSynced(localId: string, serverId: string): Promise<void> {
  const params3: SQLiteBindParams = { $serverId: serverId, $updatedAt: Date.now(), $localId: localId };
  await db.runAsync(
    `UPDATE ideas SET serverId = $serverId, updatedAt = $updatedAt WHERE localId = $localId`,
    params3
  );
}

export async function removeOutboxByLocalId(localId: string): Promise<void> {
  const params4: SQLiteBindParams = { $localId: localId };
  await db.runAsync(
    `DELETE FROM outbox WHERE json_extract(payload, '$.localId') = $localId`,
    params4
  );
}

export async function removeOutboxById(id: string): Promise<void> {
  const params: SQLiteBindParams = { $id: id };
  await db.runAsync(`DELETE FROM outbox WHERE id = $id`, params);
}

export async function getOutboxItems(): Promise<OutboxItem[]> {
  const rows = await db.getAllAsync<OutboxItem>(
    `SELECT id, action, payload, createdAt, attemptCount, lastError FROM outbox ORDER BY createdAt ASC`
  );
  return rows;
}

export async function listProjectsLocal(): Promise<IdeaRecord[]> {
  const rows = await db.getAllAsync<IdeaRecord>(
    `SELECT * FROM ideas WHERE type = 'PROJECT' AND archived = 0 ORDER BY createdAt DESC`
  );
  return rows;
}

export async function listInboxLocal(): Promise<IdeaRecord[]> {
  const rows = await db.getAllAsync<IdeaRecord>(
    `SELECT * FROM ideas WHERE status = 'INBOX' AND archived = 0 ORDER BY createdAt DESC`
  );
  return rows;
}

export async function updateIdeaLocalStatus(localId: string, status: IdeaStatus): Promise<void> {
  const params: SQLiteBindParams = { $status: status, $updatedAt: Date.now(), $localId: localId };
  await db.runAsync(
    `UPDATE ideas SET status = $status, updatedAt = $updatedAt WHERE localId = $localId`,
    params
  );
}

export async function archiveIdeaLocal(localId: string): Promise<void> {
  const params: SQLiteBindParams = { $updatedAt: Date.now(), $localId: localId };
  await db.runAsync(
    `UPDATE ideas SET archived = 1, updatedAt = $updatedAt WHERE localId = $localId`,
    params
  );
}

export async function deleteIdeaLocal(localId: string): Promise<void> {
  const params: SQLiteBindParams = { $localId: localId };
  await db.runAsync(`DELETE FROM ideas WHERE localId = $localId`, params);
}

export async function getServerIdByLocalId(localId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ serverId: string | null }>(
    `SELECT serverId FROM ideas WHERE localId = ?`,
    localId
  );
  return row?.serverId ?? null;
}

export async function listFeaturesByProjectLocal(projectLocalId: string): Promise<IdeaRecord[]> {
  const rows = await db.getAllAsync<IdeaRecord>(
    `SELECT * FROM ideas WHERE type = 'FEATURE' AND parentProjectLocalId = ? AND archived = 0 ORDER BY createdAt DESC`,
    projectLocalId
  );
  return rows;
}

export async function getOutboxStatusAll(): Promise<Array<{ localId: string; action: string; attemptCount: number; lastError: string | null }>> {
  const rows = await db.getAllAsync<{ id: string; action: string; payload: string; attemptCount: number; lastError: string | null }>(
    `SELECT id, action, payload, attemptCount, lastError FROM outbox`
  );
  const mapped: Array<{ localId: string; action: string; attemptCount: number; lastError: string | null }> = [];
  for (const r of rows) {
    try {
      const p = JSON.parse(r.payload) as { localId?: string };
      if (p.localId) mapped.push({ localId: p.localId, action: r.action, attemptCount: r.attemptCount, lastError: r.lastError ?? null });
    } catch {
      // ignore bad payloads
    }
  }
  return mapped;
}

export async function incrementOutboxAttempt(localId: string, errorMessage?: string | null): Promise<void> {
  const params: SQLiteBindParams = { $error: errorMessage ?? null, $localId: localId };
  await db.runAsync(
    `UPDATE outbox SET attemptCount = attemptCount + 1, lastError = $error WHERE json_extract(payload, '$.localId') = $localId`,
    params
  );
}

export async function listRecentIdeas(limit: number = 3): Promise<IdeaRecord[]> {
  const rows = await db.getAllAsync<IdeaRecord>(
    `SELECT * FROM ideas WHERE archived = 0 ORDER BY createdAt DESC LIMIT ?`,
    limit
  );
  return rows;
}
export async function listAllIdeas(): Promise<IdeaRecord[]> {
  const rows = await db.getAllAsync<IdeaRecord>(
    `SELECT * FROM ideas WHERE archived = 0 ORDER BY createdAt DESC`
  );
  return rows;
}