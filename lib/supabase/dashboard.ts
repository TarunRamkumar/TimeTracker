import type {
  Category,
  IntegrationAccount,
  IntegrationProvider,
  Project,
  Tag,
  Task,
  TimeBlock,
  TimerSession,
} from '@/lib/domain/types';
import { DEFAULT_CATEGORIES } from '@/lib/domain/constants';
import { serializeAppDataState } from '@/lib/app-data/serialization';
import { MOCK_INTEGRATION_ACCOUNTS } from '@/lib/mock/integrations';
import { MOCK_PROJECTS, MOCK_TAGS } from '@/lib/mock/tasks';
import { MOCK_TIME_BLOCKS } from '@/lib/mock/time-blocks';
import { MOCK_TIMER_SESSIONS } from '@/lib/mock/sessions';
import { createPublicServerClient } from '@/utils/supabase/public-server';
import {
  mapCategoryRowToDomain,
  mapIntegrationAccountRowToDomain,
  mapProjectRowToDomain,
  mapTagRowToDomain,
  mapTasksToDomain,
  mapTimeBlocksToDomain,
  mapTimerSessionRowToDomain,
  type TaskRowWithRelations,
  type TimeBlockRowWithRelations,
} from '@/lib/supabase/mappers';
import type { Database } from '@/lib/supabase/database.types';

type CategoryRow = Database['public']['Tables']['categories']['Row'];
type IntegrationAccountRow = Database['public']['Tables']['integration_accounts']['Row'];
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type TagRow = Database['public']['Tables']['tags']['Row'];
type TimerSessionRow = Database['public']['Tables']['timer_sessions']['Row'];

const TASK_SELECT = `
  id,
  title,
  description,
  status,
  priority,
  project_id,
  category_id,
  due_date,
  estimated_minutes,
  scheduled_start,
  scheduled_end,
  actual_minutes,
  calendar_block_id,
  created_at,
  updated_at,
  task_tags (
    tag_id
  ),
  task_progress_entries (
    id,
    time_block_id,
    timer_session_id,
    started_at,
    ended_at,
    duration_minutes,
    note,
    source,
    created_at,
    updated_at
  )
`;

const TIME_BLOCK_SELECT = `
  id,
  title,
  description,
  category_id,
  task_id,
  parent_block_id,
  project_id,
  project_boundary_type,
  start_at,
  end_at,
  planned_minutes,
  actual_minutes,
  source,
  status,
  recurrence_frequency,
  recurrence_days_of_week,
  recurrence_end_type,
  recurrence_until,
  recurrence_count,
  recurrence_exclusion_dates,
  recurrence_series_id,
  recurrence_index,
  google_event_id,
  calendar_id,
  hourly_rate,
  currency,
  created_at,
  updated_at,
  time_block_tags (
    tag_id
  ),
  time_block_notes (
    id,
    content,
    duration_minutes,
    kind,
    task_progress_entry_id,
    timer_session_id,
    created_at,
    updated_at
  )
`;

export type DashboardSnapshot = {
  source: 'supabase' | 'fallback';
  categories: Category[];
  projects: Project[];
  tags: Tag[];
  tasks: Task[];
  timeBlocks: TimeBlock[];
  timerSessions: TimerSession[];
  integrationAccounts: Record<IntegrationProvider, IntegrationAccount>;
};

export type DashboardBootstrapData = DashboardSnapshot & {
  initialAppDataJson: string;
};

function buildFallbackSnapshot(): DashboardSnapshot {
  return {
    source: 'fallback',
    categories: DEFAULT_CATEGORIES,
    projects: MOCK_PROJECTS,
    tags: MOCK_TAGS,
    tasks: [],
    timeBlocks: MOCK_TIME_BLOCKS,
    timerSessions: MOCK_TIMER_SESSIONS,
    integrationAccounts: MOCK_INTEGRATION_ACCOUNTS,
  };
}

function toIntegrationRecord(accounts: IntegrationAccount[]) {
  return accounts.reduce<Record<IntegrationProvider, IntegrationAccount>>(
    (record, account) => {
      record[account.provider] = account;
      return record;
    },
    { ...MOCK_INTEGRATION_ACCOUNTS }
  );
}

function hasQueryErrors(
  responses: Array<{
    error: { code?: string; message: string } | null;
  }>
) {
  return responses.some((response) => response.error !== null);
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  try {
    const supabase = createPublicServerClient();
    const [
      categoriesResult,
      tagsResult,
      projectsResult,
      tasksResult,
      timeBlocksResult,
      timerSessionsResult,
      integrationAccountsResult,
    ] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('tags').select('*').order('name'),
      supabase.from('projects').select('*').order('name'),
      supabase.from('tasks').select(TASK_SELECT).order('updated_at', { ascending: false }),
      supabase.from('time_blocks').select(TIME_BLOCK_SELECT).order('start_at'),
      supabase.from('timer_sessions').select('*').order('start_time', { ascending: false }),
      supabase.from('integration_accounts').select('*').order('provider'),
    ]);

    if (
      hasQueryErrors([
        categoriesResult,
        tagsResult,
        projectsResult,
        tasksResult,
        timeBlocksResult,
        timerSessionsResult,
        integrationAccountsResult,
      ])
    ) {
      console.warn('Falling back to local app snapshot because the Supabase schema is not ready.', {
        categories: categoriesResult.error,
        tags: tagsResult.error,
        projects: projectsResult.error,
        tasks: tasksResult.error,
        timeBlocks: timeBlocksResult.error,
        timerSessions: timerSessionsResult.error,
        integrationAccounts: integrationAccountsResult.error,
      });
      return buildFallbackSnapshot();
    }

    const categories = (categoriesResult.data as CategoryRow[] | null)?.map(mapCategoryRowToDomain) ?? [];
    const tags = (tagsResult.data as TagRow[] | null)?.map(mapTagRowToDomain) ?? [];
    const projects = (projectsResult.data as ProjectRow[] | null)?.map(mapProjectRowToDomain) ?? [];
    const tasks = mapTasksToDomain((tasksResult.data as TaskRowWithRelations[] | null) ?? []);
    const timeBlocks = mapTimeBlocksToDomain(
      (timeBlocksResult.data as TimeBlockRowWithRelations[] | null) ?? []
    );
    const timerSessions =
      (timerSessionsResult.data as TimerSessionRow[] | null)?.map(mapTimerSessionRowToDomain) ?? [];
    const integrationAccounts = toIntegrationRecord(
      ((integrationAccountsResult.data as IntegrationAccountRow[] | null) ?? []).map(
        mapIntegrationAccountRowToDomain
      )
    );

    return {
      source: 'supabase',
      categories: categories.length > 0 ? categories : DEFAULT_CATEGORIES,
      projects,
      tags: tags.length > 0 ? tags : MOCK_TAGS,
      tasks,
      timeBlocks,
      timerSessions,
      integrationAccounts,
    };
  } catch (error) {
    console.warn('Falling back to local app snapshot because Supabase could not be queried.', error);
    return buildFallbackSnapshot();
  }
}

export async function getDashboardBootstrapData(): Promise<DashboardBootstrapData> {
  const snapshot = await getDashboardSnapshot();

  return {
    ...snapshot,
    initialAppDataJson: JSON.stringify(
      serializeAppDataState({
        tasks: snapshot.tasks,
        timeBlocks: snapshot.timeBlocks,
        timerSessions: snapshot.timerSessions,
        activeTimer: null,
      })
    ),
  };
}
