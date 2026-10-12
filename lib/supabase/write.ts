import { DEFAULT_CATEGORIES } from '@/lib/domain/constants';
import type { Category, Project, Task, TimeBlock, TimerSession } from '@/lib/domain/types';
import { hydrateProjects } from '@/lib/app-data/serialization';
import type { SupabaseSyncPayload } from '@/lib/app-data/sync';
import type { Database } from '@/lib/supabase/database.types';
import { MOCK_INTEGRATION_ACCOUNTS } from '@/lib/mock/integrations';
import { MOCK_TAGS } from '@/lib/mock/tasks';
import { createAdminClient } from '@/utils/supabase/admin';

type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
type IntegrationAccountInsert = Database['public']['Tables']['integration_accounts']['Insert'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type TagInsert = Database['public']['Tables']['tags']['Insert'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type TaskProgressEntryInsert = Database['public']['Tables']['task_progress_entries']['Insert'];
type TaskTagInsert = Database['public']['Tables']['task_tags']['Insert'];
type TimeBlockInsert = Database['public']['Tables']['time_blocks']['Insert'];
type TimeBlockNoteInsert = Database['public']['Tables']['time_block_notes']['Insert'];
type TimeBlockTagInsert = Database['public']['Tables']['time_block_tags']['Insert'];
type TimerSessionInsert = Database['public']['Tables']['timer_sessions']['Insert'];

function normalizeNullableId(value?: string | null) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableText(value?: string | null) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapCategoryToInsert(category: Category): CategoryInsert {
  return {
    id: category.id,
    name: category.name,
    description: category.description ?? null,
    parent_category_ids: category.parentCategoryIds ?? [],
    color: category.color,
    icon: category.icon,
    active: category.active,
    hourly_rate: category.hourlyRate ?? null,
    currency: category.currency ?? null,
  };
}

function mapProjectToInsert(project: Project): ProjectInsert {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    category_id: project.categoryId,
    start_date: project.startDate?.toISOString() ?? null,
    end_date: project.endDate?.toISOString() ?? null,
  };
}

function mapTagToInsert(tag: (typeof MOCK_TAGS)[number]): TagInsert {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
  };
}

function mapTaskToInsert(task: Task, includeCalendarBlockId: boolean): TaskInsert {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    project_id: normalizeNullableId(task.projectId),
    category_id: task.categoryId,
    due_date: task.dueDate?.toISOString() ?? null,
    estimated_minutes: task.estimatedMinutes ?? null,
    scheduled_start: task.scheduledStart?.toISOString() ?? null,
    scheduled_end: task.scheduledEnd?.toISOString() ?? null,
    actual_minutes: task.actualMinutes,
    calendar_block_id: includeCalendarBlockId ? normalizeNullableId(task.calendarBlockId) : null,
    created_at: task.createdAt.toISOString(),
    updated_at: task.updatedAt.toISOString(),
  };
}

function mapTimeBlockToInsert(block: TimeBlock): TimeBlockInsert {
  return {
    id: block.id,
    title: block.title,
    description: block.description,
    category_id: block.categoryId,
    task_id: normalizeNullableId(block.taskId),
    parent_block_id: normalizeNullableId(block.parentBlockId),
    project_id: normalizeNullableId(block.projectId),
    project_boundary_type: block.projectBoundaryType ?? null,
    start_at: block.start.toISOString(),
    end_at: block.end.toISOString(),
    planned_minutes: block.plannedMinutes,
    actual_minutes: block.actualMinutes,
    source: block.source,
    status: block.status,
    recurrence_frequency: block.recurrence?.frequency ?? null,
    recurrence_days_of_week: block.recurrence?.daysOfWeek ?? null,
    recurrence_end_type: block.recurrence?.endType ?? null,
    recurrence_until: block.recurrence?.until?.toISOString() ?? null,
    recurrence_count: block.recurrence?.count ?? null,
    recurrence_exclusion_dates:
      block.recurrence?.exclusionDates?.map((value) => value.toISOString()) ?? null,
    recurrence_series_id: block.recurrence?.seriesId ?? null,
    recurrence_index: block.recurrenceIndex ?? null,
    google_event_id: normalizeNullableText(block.googleEventId),
    calendar_id: normalizeNullableText(block.calendarId),
    hourly_rate: block.hourlyRate ?? null,
    currency: block.currency ?? null,
  };
}

function mapTimerSessionToInsert(session: TimerSession): TimerSessionInsert {
  return {
    id: session.id,
    task_id: normalizeNullableId(session.taskId),
    category_id: session.categoryId,
    start_time: session.startTime.toISOString(),
    end_time: session.endTime?.toISOString() ?? null,
    duration_minutes: session.durationMinutes,
    pomodoro_mode: session.pomodoroMode,
    source: session.source,
  };
}

function mapIntegrationAccountToInsert(
  account: (typeof MOCK_INTEGRATION_ACCOUNTS)[keyof typeof MOCK_INTEGRATION_ACCOUNTS]
): IntegrationAccountInsert {
  return {
    id: account.id,
    provider: account.provider,
    status: account.status,
    external_account_id: account.externalAccountId,
    last_synced_at: account.lastSyncedAt?.toISOString() ?? null,
  };
}

function buildTaskTagRows(tasks: Task[]): TaskTagInsert[] {
  return tasks.flatMap((task) =>
    task.tagIds.map((tagId) => ({
      task_id: task.id,
      tag_id: tagId,
    }))
  );
}

function buildTaskProgressRows(tasks: Task[]): TaskProgressEntryInsert[] {
  return tasks.flatMap((task) =>
    task.progressEntries.map((entry) => ({
      id: entry.id,
      task_id: task.id,
      time_block_id: normalizeNullableId(entry.timeBlockId),
      timer_session_id: normalizeNullableId(entry.timerSessionId),
      started_at: entry.startedAt?.toISOString() ?? null,
      ended_at: entry.endedAt?.toISOString() ?? null,
      duration_minutes: entry.durationMinutes,
      note: entry.note,
      source: entry.source,
      created_at: entry.createdAt.toISOString(),
      updated_at: entry.updatedAt.toISOString(),
    }))
  );
}

function buildTimeBlockTagRows(blocks: TimeBlock[]): TimeBlockTagInsert[] {
  return blocks.flatMap((block) =>
    block.tagIds.map((tagId) => ({
      time_block_id: block.id,
      tag_id: tagId,
    }))
  );
}

function buildTimeBlockNoteRows(blocks: TimeBlock[]): TimeBlockNoteInsert[] {
  return blocks.flatMap((block) =>
    block.notes.map((note) => ({
      id: note.id,
      time_block_id: block.id,
      content: note.content,
      duration_minutes: note.durationMinutes,
      kind: note.kind,
      task_progress_entry_id: normalizeNullableId(note.taskProgressEntryId),
      timer_session_id: normalizeNullableId(note.timerSessionId),
      created_at: note.createdAt.toISOString(),
      updated_at: note.updatedAt.toISOString(),
    }))
  );
}

async function syncReferenceRows<T extends { id: string }>(
  table: 'categories' | 'projects',
  rows: T[]
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { data, error } = await supabase.from(table).select('id');

  if (error) {
    throw error;
  }

  const nextIds = new Set(rows.map((row) => row.id));
  const staleIds = ((data ?? []) as Array<{ id: string }>)
    .map((row) => row.id)
    .filter((id) => !nextIds.has(id));

  if (staleIds.length === 0) {
    return;
  }

  const deleteResult = await supabase.from(table).delete().in('id', staleIds);
  if (deleteResult.error) {
    throw deleteResult.error;
  }
}

async function ensureReferenceData(categories: Category[], projects: Project[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const categoryRows = (categories.length > 0 ? categories : DEFAULT_CATEGORIES).map(mapCategoryToInsert);
  const projectRows = projects.map(mapProjectToInsert);
  const tagRows = MOCK_TAGS.map(mapTagToInsert);
  const integrationRows = Object.values(MOCK_INTEGRATION_ACCOUNTS).map(mapIntegrationAccountToInsert);

  const [categoriesResult, tagsResult, integrationsResult] = await Promise.all([
    supabase.from('categories').upsert(categoryRows, { onConflict: 'id' }),
    supabase.from('tags').upsert(tagRows, { onConflict: 'id' }),
    supabase.from('integration_accounts').upsert(integrationRows, { onConflict: 'id' }),
  ]);

  if (categoriesResult.error) {
    throw categoriesResult.error;
  }

  if (tagsResult.error) {
    throw tagsResult.error;
  }

  if (integrationsResult.error) {
    throw integrationsResult.error;
  }

  await syncReferenceRows('projects', projectRows);

  if (projectRows.length > 0) {
    const projectsResult = await supabase.from('projects').upsert(projectRows, { onConflict: 'id' });
    if (projectsResult.error) {
      throw projectsResult.error;
    }
  } else {
    const deleteProjectsResult = await supabase.from('projects').delete().not('id', 'is', null);
    if (deleteProjectsResult.error) {
      throw deleteProjectsResult.error;
    }
  }

  await syncReferenceRows('categories', categoryRows);
}

async function clearMutableData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const clearQueries = await Promise.all([
    supabase.from('time_block_notes').delete().not('id', 'is', null),
    supabase.from('task_progress_entries').delete().not('id', 'is', null),
    supabase.from('task_tags').delete().not('task_id', 'is', null),
    supabase.from('time_block_tags').delete().not('time_block_id', 'is', null),
    supabase.from('timer_sessions').delete().not('id', 'is', null),
    supabase.from('time_blocks').delete().not('id', 'is', null),
    supabase.from('tasks').delete().not('id', 'is', null),
  ]);

  for (const result of clearQueries) {
    if (result.error) {
      throw result.error;
    }
  }
}

async function insertMutableData(tasks: Task[], timeBlocks: TimeBlock[], timerSessions: TimerSession[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const baseTaskRows = tasks.map((task) => mapTaskToInsert(task, false));
  const finalTaskRows = tasks.map((task) => mapTaskToInsert(task, true));
  const taskTagRows = buildTaskTagRows(tasks);
  const taskProgressRows = buildTaskProgressRows(tasks);
  const timeBlockRows = timeBlocks.map(mapTimeBlockToInsert);
  const timeBlockTagRows = buildTimeBlockTagRows(timeBlocks);
  const timeBlockNoteRows = buildTimeBlockNoteRows(timeBlocks);
  const timerSessionRows = timerSessions.map(mapTimerSessionToInsert);

  if (baseTaskRows.length > 0) {
    const result = await supabase.from('tasks').upsert(baseTaskRows, { onConflict: 'id' });
    if (result.error) {
      throw result.error;
    }
  }

  if (taskTagRows.length > 0) {
    const result = await supabase.from('task_tags').insert(taskTagRows);
    if (result.error) {
      throw result.error;
    }
  }

  if (timeBlockRows.length > 0) {
    const result = await supabase.from('time_blocks').upsert(timeBlockRows, { onConflict: 'id' });
    if (result.error) {
      throw result.error;
    }
  }

  if (finalTaskRows.length > 0) {
    const result = await supabase.from('tasks').upsert(finalTaskRows, { onConflict: 'id' });
    if (result.error) {
      throw result.error;
    }
  }

  if (timerSessionRows.length > 0) {
    const result = await supabase.from('timer_sessions').upsert(timerSessionRows, {
      onConflict: 'id',
    });
    if (result.error) {
      throw result.error;
    }
  }

  if (taskProgressRows.length > 0) {
    const result = await supabase.from('task_progress_entries').upsert(taskProgressRows, {
      onConflict: 'id',
    });
    if (result.error) {
      throw result.error;
    }
  }

  if (timeBlockTagRows.length > 0) {
    const result = await supabase.from('time_block_tags').insert(timeBlockTagRows);
    if (result.error) {
      throw result.error;
    }
  }

  if (timeBlockNoteRows.length > 0) {
    const result = await supabase.from('time_block_notes').upsert(timeBlockNoteRows, {
      onConflict: 'id',
    });
    if (result.error) {
      throw result.error;
    }
  }
}

export async function syncSnapshotToSupabase(payload: SupabaseSyncPayload) {
  const categories = payload.categories.length > 0 ? payload.categories : DEFAULT_CATEGORIES;
  const projects = hydrateProjects(payload.projects);
  const tasks = payload.appData.tasks.map((task) => ({
    ...task,
    dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
    scheduledStart: task.scheduledStart ? new Date(task.scheduledStart) : undefined,
    scheduledEnd: task.scheduledEnd ? new Date(task.scheduledEnd) : undefined,
    progressEntries: task.progressEntries.map((entry) => ({
      ...entry,
      startedAt: entry.startedAt ? new Date(entry.startedAt) : undefined,
      endedAt: entry.endedAt ? new Date(entry.endedAt) : undefined,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
    })),
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),
  }));
  const timeBlocks = payload.appData.timeBlocks.map((block) => ({
    ...block,
    start: new Date(block.start),
    end: new Date(block.end),
    notes: block.notes.map((note) => ({
      ...note,
      createdAt: new Date(note.createdAt),
      updatedAt: new Date(note.updatedAt),
    })),
    recurrence: block.recurrence
      ? {
          ...block.recurrence,
          until: block.recurrence.until ? new Date(block.recurrence.until) : undefined,
          exclusionDates: block.recurrence.exclusionDates?.map((value) => new Date(value)),
        }
      : undefined,
  }));
  const timerSessions = payload.appData.timerSessions.map((session) => ({
    ...session,
    startTime: new Date(session.startTime),
    endTime: session.endTime ? new Date(session.endTime) : undefined,
  }));

  await clearMutableData();
  await ensureReferenceData(categories, projects);
  await insertMutableData(tasks, timeBlocks, timerSessions);
}
