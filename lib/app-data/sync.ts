import type { Category } from '@/lib/domain/types';
import type { PersistedAppData, PersistedProject } from '@/lib/app-data/serialization';

export interface SupabaseSyncPayload {
  categories: Category[];
  projects: PersistedProject[];
  appData: PersistedAppData;
}
