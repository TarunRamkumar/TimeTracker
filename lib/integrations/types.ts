import {
  IntegrationAccount,
  IntegrationProvider,
  Task,
  TimeBlock,
  TimerSession,
} from '../domain/types';

export interface SyncWindow {
  start: Date;
  end: Date;
}

export interface ExternalRecordRef {
  externalId: string;
  url?: string;
  containerId?: string;
}

export interface IntegrationCapabilitySet {
  timeBlocks: boolean;
  tasks: boolean;
  timerSessions: boolean;
  twoWaySync: boolean;
}

export interface IntegrationDescriptor {
  provider: IntegrationProvider;
  displayName: string;
  description: string;
  icon: string;
  primarySurface: 'calendar' | 'tasks' | 'timer';
  capabilities: IntegrationCapabilitySet;
}

export interface IntegrationStatusSnapshot {
  connected: boolean;
  lastSyncedAt?: Date;
  error?: string;
  account?: IntegrationAccount;
}

export interface IntegrationAdapterBase {
  readonly provider: IntegrationProvider;
  readonly descriptor: IntegrationDescriptor;

  connect(): Promise<IntegrationStatusSnapshot>;
  disconnect(): Promise<void>;
  getStatus(): Promise<IntegrationStatusSnapshot>;
}

export interface CalendarIntegrationAdapter<TRemoteEvent> extends IntegrationAdapterBase {
  listTimeBlocks(range: SyncWindow): Promise<TimeBlock[]>;
  createTimeBlock(block: TimeBlock): Promise<ExternalRecordRef>;
  updateTimeBlock(block: TimeBlock): Promise<ExternalRecordRef>;
  deleteTimeBlock(externalEventId: string): Promise<void>;
  toProviderTimeBlock(block: TimeBlock): TRemoteEvent;
  fromProviderTimeBlock(event: TRemoteEvent): TimeBlock;
}

export interface TaskIntegrationAdapter<TRemoteTask> extends IntegrationAdapterBase {
  listTasks(): Promise<Task[]>;
  createTask(task: Task): Promise<ExternalRecordRef>;
  updateTask(task: Task): Promise<ExternalRecordRef>;
  archiveTask(externalTaskId: string): Promise<void>;
  toProviderTask(task: Task): TRemoteTask;
  fromProviderTask(remoteTask: TRemoteTask): Task;
}

export interface TimeTrackingIntegrationAdapter<TRemoteEntry> extends IntegrationAdapterBase {
  listSessions(range: SyncWindow): Promise<TimerSession[]>;
  createSession(session: TimerSession): Promise<ExternalRecordRef>;
  startTimer(taskId?: Task['id']): Promise<ExternalRecordRef>;
  stopTimer(externalSessionId: string): Promise<TimerSession>;
  getTrackedMinutesForTask(taskId: Task['id']): Promise<number>;
  toProviderTimerSession(session: TimerSession): TRemoteEntry;
  fromProviderTimerSession(entry: TRemoteEntry): TimerSession;
}
