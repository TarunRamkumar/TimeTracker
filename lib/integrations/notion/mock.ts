import { getIntegrationDescriptor } from '../catalog';
import { ExternalRecordRef, IntegrationStatusSnapshot } from '../types';
import { Task } from '../../domain/types';
import { MOCK_INTEGRATION_ACCOUNTS } from '../../mock/integrations';
import { MOCK_TASKS } from '../../mock/tasks';
import { mapNotionPageToTask, mapTaskToNotionPage } from './mappers';
import { NotionTaskPage, NotionTaskProvider, NotionWorkspaceIds } from './types';

export class MockNotionProvider implements NotionTaskProvider {
  readonly provider = 'notion' as const;
  readonly descriptor = getIntegrationDescriptor(this.provider);

  private connected = MOCK_INTEGRATION_ACCOUNTS[this.provider].status === 'connected';
  private lastSyncedAt = MOCK_INTEGRATION_ACCOUNTS[this.provider].lastSyncedAt;
  private readonly workspaceIds: NotionWorkspaceIds = {
    tasks: 'notion-db-tasks',
    schedule: 'notion-db-schedule',
    sessions: 'notion-db-sessions',
  };

  async connect(): Promise<IntegrationStatusSnapshot> {
    this.connected = true;
    this.lastSyncedAt = new Date();
    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getStatus(): Promise<IntegrationStatusSnapshot> {
    return {
      connected: this.connected,
      lastSyncedAt: this.lastSyncedAt,
      account: this.connected ? MOCK_INTEGRATION_ACCOUNTS[this.provider] : undefined,
    };
  }

  async getWorkspaceIds(): Promise<NotionWorkspaceIds> {
    return this.workspaceIds;
  }

  async listTasks(): Promise<Task[]> {
    if (!this.connected) {
      return [];
    }

    return MOCK_TASKS.map((task) => this.fromProviderTask(this.toProviderTask(task)));
  }

  async createTask(task: Task): Promise<ExternalRecordRef> {
    this.assertConnected();
    const page = this.toProviderTask(task);
    this.lastSyncedAt = new Date();

    return {
      externalId: page.id,
      containerId: page.databaseId,
      url: page.url,
    };
  }

  async updateTask(task: Task): Promise<ExternalRecordRef> {
    return this.createTask(task);
  }

  async archiveTask(externalTaskId: string): Promise<void> {
    this.assertConnected();
    void externalTaskId;
    this.lastSyncedAt = new Date();
  }

  toProviderTask(task: Task): NotionTaskPage {
    return mapTaskToNotionPage(task, { databaseId: this.workspaceIds.tasks });
  }

  fromProviderTask(remoteTask: NotionTaskPage): Task {
    return mapNotionPageToTask(remoteTask);
  }

  private assertConnected() {
    if (!this.connected) {
      throw new Error('Not connected to Notion');
    }
  }
}
