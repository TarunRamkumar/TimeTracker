import { CalendarIntegrationAdapter } from '../types';

export interface GoogleCalendarEvent {
  id: string;
  calendarId: string;
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  colorId?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  recurrence?: string[];
  extendedProperties: {
    private: Record<string, string>;
  };
}

export interface GoogleCalendarAccount {
  id: string;
  email: string;
}

export interface GoogleCalendarProvider extends CalendarIntegrationAdapter<GoogleCalendarEvent> {
  getAccount(): Promise<GoogleCalendarAccount | null>;
  forceSync(): Promise<void>;
}
