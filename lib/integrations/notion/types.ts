import { TaskIntegrationAdapter } from '../types';

export interface NotionTaskPage {
  id: string;
  databaseId: string;
  url: string;
  archived: boolean;
  properties: {
    title: string;
    description: string;
    status: string;
    priority: string;
    categoryId: string;
    tagIds: string[];
    projectId?: string;
    dueDate?: string;
    estimatedMinutes?: number;
    actualMinutes: number;
    scheduledStart?: string;
    scheduledEnd?: string;
  };
}

export interface NotionTimeBlockPage {
  id: string;
  databaseId: string;
  url: string;
  archived: boolean;
  properties: {
    title: string;
    description: string;
    categoryId: string;
    tagIds: string[];
    taskId?: string;
    start: string;
    end: string;
    plannedMinutes: number;
    actualMinutes: number;
    source: string;
    status: string;
  };
}

export interface NotionSessionPage {
  id: string;
  databaseId: string;
  url: string;
  archived: boolean;
  properties: {
    title: string;
    taskId?: string;
    categoryId: string;
    startTime: string;
    endTime?: string;
    durationMinutes: number;
    pomodoroMode: boolean;
    source: string;
  };
}

export interface NotionWorkspaceIds {
  tasks: string;
  schedule: string;
  sessions: string;
}

export interface NotionTaskProvider extends TaskIntegrationAdapter<NotionTaskPage> {
  getWorkspaceIds(): Promise<NotionWorkspaceIds>;
}
