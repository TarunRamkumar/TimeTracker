'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { serializeAppDataState, serializeProjects } from '@/lib/app-data/serialization';
import type { SupabaseSyncPayload } from '@/lib/app-data/sync';
import { useAppData } from '@/components/providers/AppDataProvider';
import { useCategories } from '@/components/providers/CategoriesProvider';

const SYNC_DEBOUNCE_MS = 800;
const RETRY_DELAY_MS = 5000;

export function SupabaseSync() {
  const { categories } = useCategories();
  const { tasks, timeBlocks, timerSessions, projects } = useAppData();
  const [retryToken, setRetryToken] = useState(0);
  const lastSyncedRef = useRef<string | null>(null);

  const payload = useMemo<SupabaseSyncPayload>(
    () => ({
      categories,
      projects: serializeProjects(projects),
      appData: serializeAppDataState({
        tasks,
        timeBlocks,
        timerSessions,
        activeTimer: null,
      }),
    }),
    [categories, projects, tasks, timeBlocks, timerSessions]
  );

  const payloadJson = useMemo(() => JSON.stringify(payload), [payload]);

  useEffect(() => {
    if (payloadJson === lastSyncedRef.current) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/app-data/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: payloadJson,
          keepalive: true,
        });

        if (!response.ok) {
          throw new Error(`Sync failed with status ${response.status}`);
        }

        if (!cancelled) {
          lastSyncedRef.current = payloadJson;
        }
      } catch (error) {
        console.error('Supabase sync attempt failed.', error);

        if (!cancelled) {
          window.setTimeout(() => {
            setRetryToken((value) => value + 1);
          }, RETRY_DELAY_MS);
        }
      }
    }, SYNC_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [payloadJson, retryToken]);

  return null;
}
