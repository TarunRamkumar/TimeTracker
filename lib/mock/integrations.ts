import { IntegrationAccount, IntegrationProvider } from '../domain/types';

export const MOCK_INTEGRATION_ACCOUNTS: Record<IntegrationProvider, IntegrationAccount> = {
  'google-calendar': {
    id: 'integration-google-calendar' as IntegrationAccount['id'],
    provider: 'google-calendar',
    status: 'connected',
    externalAccountId: 'google-account-primary',
    lastSyncedAt: new Date(),
  },
  notion: {
    id: 'integration-notion' as IntegrationAccount['id'],
    provider: 'notion',
    status: 'disconnected',
    externalAccountId: 'notion-workspace-sandbox',
  },
  clockify: {
    id: 'integration-clockify' as IntegrationAccount['id'],
    provider: 'clockify',
    status: 'disconnected',
    externalAccountId: 'clockify-workspace-sandbox',
  },
};
