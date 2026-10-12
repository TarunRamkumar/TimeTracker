import { TimeTrackingIntegrationAdapter } from '../types';

export interface ClockifyTimeEntry {
  id: string;
  workspaceId: string;
  description: string;
  start: string;
  end?: string;
  durationMinutes: number;
  projectId?: string;
  taskId?: string;
  tagIds: string[];
  billable: boolean;
  customFields: Record<string, string>;
}

export interface ClockifyTaskRecord {
  id: string;
  workspaceId: string;
  name: string;
  projectId?: string;
  status: 'ACTIVE' | 'DONE';
  estimateMinutes?: number;
  actualMinutes: number;
  note: string;
}

export interface ClockifyProvider extends TimeTrackingIntegrationAdapter<ClockifyTimeEntry> {
  getWorkspaceId(): Promise<string | null>;
}
