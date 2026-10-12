import { IntegrationProvider } from '../domain/types';
import { IntegrationDescriptor } from './types';

export const INTEGRATION_ORDER: IntegrationProvider[] = [
  'google-calendar',
  'notion',
  'clockify',
];

export const INTEGRATION_CATALOG: Record<IntegrationProvider, IntegrationDescriptor> = {
  'google-calendar': {
    provider: 'google-calendar',
    displayName: 'Google Calendar',
    description: 'Two-way calendar sync for scheduled blocks and completed focus sessions.',
    icon: '📅',
    primarySurface: 'calendar',
    capabilities: {
      timeBlocks: true,
      tasks: false,
      timerSessions: true,
      twoWaySync: true,
    },
  },
  notion: {
    provider: 'notion',
    displayName: 'Notion',
    description: 'Database-backed task sync for scheduled work, properties, and status changes.',
    icon: '🔗',
    primarySurface: 'tasks',
    capabilities: {
      timeBlocks: true,
      tasks: true,
      timerSessions: true,
      twoWaySync: false,
    },
  },
  clockify: {
    provider: 'clockify',
    displayName: 'Clockify',
    description: 'External time tracking sync for timers, sessions, and task-level totals.',
    icon: '⏱️',
    primarySurface: 'timer',
    capabilities: {
      timeBlocks: true,
      tasks: true,
      timerSessions: true,
      twoWaySync: false,
    },
  },
};

export function listIntegrationDescriptors(): IntegrationDescriptor[] {
  return INTEGRATION_ORDER.map((provider) => INTEGRATION_CATALOG[provider]);
}

export function getIntegrationDescriptor(provider: IntegrationProvider): IntegrationDescriptor {
  return INTEGRATION_CATALOG[provider];
}
