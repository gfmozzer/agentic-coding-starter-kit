export interface ReviewFieldState {
  key: string;
  originalValue: string;
  value: string;
  sourceAgentId?: string;
  edited: boolean;
}

export interface ReviewAuditEntry {
  id: string;
  key: string;
  oldValue: string | null;
  newValue: string | null;
  sourceAgentId?: string | null;
  editedBy?: string | null;
  editedAt: string;
}

