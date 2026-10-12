import { getIntegrationDescriptor } from '../catalog';
import { ExternalRecordRef, IntegrationStatusSnapshot, SyncWindow } from '../types';
import { Task, TimerSession } from '../../domain/types';
import { MOCK_INTEGRATION_ACCOUNTS } from '../../mock/integrations';
import { MOCK_TIMER_SESSIONS } from '../../mock/sessions';
import {
  mapClockifyTimeEntryToTimerSession,
  mapTimerSessionToClockifyTimeEntry,
} from './mappers';
import { ClockifyProvider, ClockifyTimeEntry } from './types';

export class MockClockifyProvider implements ClockifyProvider {
  readonly provider = 'clockify' as const;
  readonly descriptor = getIntegrationDescriptor(this.provider);

  private connected = MOCK_INTEGRATION_ACCOUNTS[this.provider].status === 'connected';
  private lastSyncedAt = MOCK_INTEGRATION_ACCOUNTS[this.provider].lastSyncedAt;
  private readonly workspaceId = MOCK_INTEGRATION_ACCOUNTS[this.provider].externalAccountId;
  private runningEntry: ClockifyTimeEntry | null = null;

  async connect(): Promise<IntegrationStatusSnapshot> {
    this.connected = true;
    this.lastSyncedAt = new Date();
    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.runningEntry = null;
  }

  async getStatus(): Promise<IntegrationStatusSnapshot> {
    return {
      connected: this.connected,
      lastSyncedAt: this.lastSyncedAt,
      account: this.connected ? MOCK_INTEGRATION_ACCOUNTS[this.provider] : undefined,
    };
  }

  async getWorkspaceId(): Promise<string | null> {
    return this.connected ? this.workspaceId : null;
  }

  async listSessions(range: SyncWindow): Promise<TimerSession[]> {
    if (!this.connected) {
      return [];
    }

    return MOCK_TIMER_SESSIONS.filter(
      (session) =>
        session.startTime >= range.start &&
        session.startTime <= range.end
    ).map((session) => this.fromProviderTimerSession(this.toProviderTimerSession(session)));
  }

  async createSession(session: TimerSession): Promise<ExternalRecordRef> {
    this.assertConnected();
    const entry = this.toProviderTimerSession(session);
    this.lastSyncedAt = new Date();

    return {
      externalId: entry.id,
      containerId: entry.workspaceId,
      url: `https://app.clockify.me/tracker/${entry.id}`,
    };
  }

  async startTimer(taskId?: Task['id']): Promise<ExternalRecordRef> {
    this.assertConnected();
    const startedAt = new Date();
    this.runningEntry = {
      id: `clockify-running-${startedAt.getTime()}`,
      workspaceId: this.workspaceId,
      description: 'Running TimeTracker timer',
      start: startedAt.toISOString(),
      durationMinutes: 0,
      taskId: taskId ? (taskId as string) : undefined,
      tagIds: [],
      billable: false,
      customFields: {
        categoryId: 'cat-work',
        pomodoroMode: 'false',
        source: 'web',
      },
    };

    return {
      externalId: this.runningEntry.id,
      containerId: this.runningEntry.workspaceId,
      url: `https://app.clockify.me/tracker/${this.runningEntry.id}`,
    };
  }

  async stopTimer(externalSessionId: string): Promise<TimerSession> {
    this.assertConnected();

    if (!this.runningEntry || this.runningEntry.id !== externalSessionId) {
      throw new Error('No running Clockify session matches the requested ID');
    }

    const endedAt = new Date();
    const startedAt = new Date(this.runningEntry.start);
    const durationMinutes = Math.max(
      1,
      Math.round((endedAt.getTime() - startedAt.getTime()) / (1000 * 60))
    );

    const completedEntry: ClockifyTimeEntry = {
      ...this.runningEntry,
      end: endedAt.toISOString(),
      durationMinutes,
    };

    this.runningEntry = null;
    this.lastSyncedAt = new Date();

    return this.fromProviderTimerSession(completedEntry);
  }

  async getTrackedMinutesForTask(taskId: Task['id']): Promise<number> {
    if (!this.connected) {
      return 0;
    }

    return MOCK_TIMER_SESSIONS.filter((session) => session.taskId === taskId).reduce(
      (sum, session) => sum + session.durationMinutes,
      0
    );
  }

  toProviderTimerSession(session: TimerSession): ClockifyTimeEntry {
    return mapTimerSessionToClockifyTimeEntry(session, { workspaceId: this.workspaceId });
  }

  fromProviderTimerSession(entry: ClockifyTimeEntry): TimerSession {
    return mapClockifyTimeEntryToTimerSession(entry);
  }

  private assertConnected() {
    if (!this.connected) {
      throw new Error('Not connected to Clockify');
    }
  }
}
