import { getIntegrationDescriptor } from '../catalog';
import { MOCK_INTEGRATION_ACCOUNTS } from '../../mock/integrations';
import { MOCK_TIME_BLOCKS } from '../../mock/time-blocks';
import { TimeBlock } from '../../domain/types';
import { ExternalRecordRef, IntegrationStatusSnapshot, SyncWindow } from '../types';
import {
  mapGoogleCalendarEventToTimeBlock,
  mapTimeBlockToGoogleCalendarEvent,
} from './mappers';
import { GoogleCalendarAccount, GoogleCalendarEvent, GoogleCalendarProvider } from './types';

export class MockGoogleCalendarProvider implements GoogleCalendarProvider {
  readonly provider = 'google-calendar' as const;
  readonly descriptor = getIntegrationDescriptor(this.provider);

  private connected = MOCK_INTEGRATION_ACCOUNTS[this.provider].status === 'connected';
  private lastSyncedAt = MOCK_INTEGRATION_ACCOUNTS[this.provider].lastSyncedAt;
  private readonly account: GoogleCalendarAccount = {
    id: MOCK_INTEGRATION_ACCOUNTS[this.provider].externalAccountId,
    email: 'student@example.com',
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

  async getAccount(): Promise<GoogleCalendarAccount | null> {
    return this.connected ? this.account : null;
  }

  async listTimeBlocks(range: SyncWindow): Promise<TimeBlock[]> {
    if (!this.connected) {
      return [];
    }

    return MOCK_TIME_BLOCKS.filter(
      (block) =>
        block.start >= range.start &&
        block.start <= range.end &&
        block.status !== 'cancelled'
    ).map((block) => this.fromProviderTimeBlock(this.toProviderTimeBlock(block)));
  }

  async createTimeBlock(block: TimeBlock): Promise<ExternalRecordRef> {
    this.assertConnected();
    const event = this.toProviderTimeBlock(block);
    this.lastSyncedAt = new Date();

    return {
      externalId: event.id,
      containerId: event.calendarId,
      url: `https://calendar.google.com/calendar/event?eid=${event.id}`,
    };
  }

  async updateTimeBlock(block: TimeBlock): Promise<ExternalRecordRef> {
    return this.createTimeBlock(block);
  }

  async deleteTimeBlock(externalEventId: string): Promise<void> {
    this.assertConnected();
    void externalEventId;
    this.lastSyncedAt = new Date();
  }

  async forceSync(): Promise<void> {
    this.assertConnected();
    this.lastSyncedAt = new Date();
  }

  toProviderTimeBlock(block: TimeBlock): GoogleCalendarEvent {
    return mapTimeBlockToGoogleCalendarEvent(block);
  }

  fromProviderTimeBlock(event: GoogleCalendarEvent): TimeBlock {
    return mapGoogleCalendarEventToTimeBlock(event);
  }

  private assertConnected() {
    if (!this.connected) {
      throw new Error('Not connected to Google Calendar');
    }
  }
}
