import { IntegrationProvider } from '../domain/types';
import { MockClockifyProvider } from './clockify/mock';
import { MockGoogleCalendarProvider } from './google-calendar/mock';
import { MockNotionProvider } from './notion/mock';

export const mockIntegrationRegistry = {
  'google-calendar': new MockGoogleCalendarProvider(),
  notion: new MockNotionProvider(),
  clockify: new MockClockifyProvider(),
} as const;

export function getMockIntegrationAdapter(provider: 'google-calendar'): MockGoogleCalendarProvider;
export function getMockIntegrationAdapter(provider: 'notion'): MockNotionProvider;
export function getMockIntegrationAdapter(provider: 'clockify'): MockClockifyProvider;
export function getMockIntegrationAdapter(provider: IntegrationProvider) {
  return mockIntegrationRegistry[provider];
}
