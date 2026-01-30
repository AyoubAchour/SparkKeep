export type IdeaType = 'PROJECT' | 'FEATURE';
export type IdeaStatus = 'INBOX' | 'BACKLOG' | 'IN_PROGRESS' | 'DONE';

export interface IdeaRecord {
  localId: string; // local UUID
  serverId?: string | null; // Convex Id<"ideas"> as string
  content: string;
  type: IdeaType;
  parentProjectLocalId?: string | null;
  parentProjectServerId?: string | null;
  status: IdeaStatus;
  archived: 0 | 1;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

export interface OutboxItem {
  id: string; // local UUID
  action: 'createProject' | 'createFeature' | 'updateIdea' | 'updateStatus' | 'archiveIdea' | 'deleteIdea';
  payload: string; // JSON string payload
  createdAt: number;
  attemptCount: number;
  lastError?: string | null;
}
