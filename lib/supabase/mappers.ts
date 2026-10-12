import type {
  Category,
  CategoryId,
  IntegrationAccount,
  Project,
  ProjectBoundaryType,
  ProjectId,
  Tag,
  TagId,
  Task,
  TaskId,
  TaskProgressEntry,
  TaskProgressEntryId,
  TimeBlock,
  TimeBlockId,
  TimeBlockNote,
  TimeBlockNoteId,
  TimerSession,
  TimerSessionId,
} from '@/lib/domain/types';
import type { Database } from '@/lib/supabase/database.types';

type CategoryRow = Database['public']['Tables']['categories']['Row'];
type TagRow = Database['public']['Tables']['tags']['Row'];
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type TaskRow = Database['public']['Tables']['tasks']['Row'];
type TaskTagRow = Database['public']['Tables']['task_tags']['Row'];
type TaskProgressEntryRow = Database['public']['Tables']['task_progress_entries']['Row'];
type TimeBlockRow = Database['public']['Tables']['time_blocks']['Row'];
type TimeBlockTagRow = Database['public']['Tables']['time_block_tags']['Row'];
type TimeBlockNoteRow = Database['public']['Tables']['time_block_notes']['Row'];
type TimerSessionRow = Database['public']['Tables']['timer_sessions']['Row'];
type IntegrationAccountRow = Database['public']['Tables']['integration_accounts']['Row'];

export type TaskRowWithRelations = TaskRow & {
  task_progress_entries: TaskProgressEntryRow[] | null;
  task_tags: Pick<TaskTagRow, 'tag_id'>[] | null;
};

export type TimeBlockRowWithRelations = TimeBlockRow & {
  time_block_notes: TimeBlockNoteRow[] | null;
  time_block_tags: Pick<TimeBlockTagRow, 'tag_id'>[] | null;
};

function toDate(value?: string | null) {
  return value ? new Date(value) : undefined;
}

function sortByUpdatedAtDescending<T extends { updatedAt: Date }>(items: T[]) {
  return [...items].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
}

function sortBlocksByStart(blocks: TimeBlock[]) {
  return [...blocks].sort((left, right) => left.start.getTime() - right.start.getTime());
}

export function mapCategoryRowToDomain(row: CategoryRow): Category {
  return {
    id: row.id as CategoryId,
    name: row.name,
    description: row.description ?? undefined,
    parentCategoryIds: (row.parent_category_ids ?? []) as CategoryId[],
    color: row.color,
    icon: row.icon,
    active: row.active,
    hourlyRate: row.hourly_rate,
    currency: row.currency,
  };
}

export function mapTagRowToDomain(row: TagRow): Tag {
  return {
    id: row.id as TagId,
    name: row.name,
    color: row.color,
  };
}

export function mapProjectRowToDomain(row: ProjectRow): Project {
  return {
    id: row.id as ProjectId,
    name: row.name,
    description: row.description,
    status: row.status,
    categoryId: row.category_id as CategoryId,
    startDate: toDate(row.start_date),
    endDate: toDate(row.end_date),
  };
}

export function mapTaskProgressEntryRowToDomain(row: TaskProgressEntryRow): TaskProgressEntry {
  return {
    id: row.id as TaskProgressEntryId,
    timeBlockId: row.time_block_id ? (row.time_block_id as TimeBlockId) : undefined,
    timerSessionId: row.timer_session_id ? (row.timer_session_id as TimerSessionId) : undefined,
    startedAt: toDate(row.started_at),
    endedAt: toDate(row.ended_at),
    durationMinutes: row.duration_minutes,
    note: row.note,
    source: row.source,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapTaskRowToDomain(row: TaskRowWithRelations): Task {
  const progressEntries = sortByUpdatedAtDescending(
    (row.task_progress_entries ?? []).map(mapTaskProgressEntryRowToDomain)
  );

  return {
    id: row.id as TaskId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    projectId: row.project_id ? (row.project_id as ProjectId) : undefined,
    categoryId: row.category_id as CategoryId,
    tagIds: (row.task_tags ?? []).map((link) => link.tag_id as TagId),
    dueDate: toDate(row.due_date),
    estimatedMinutes: row.estimated_minutes ?? undefined,
    scheduledStart: toDate(row.scheduled_start),
    scheduledEnd: toDate(row.scheduled_end),
    actualMinutes: row.actual_minutes,
    calendarBlockId: row.calendar_block_id ? (row.calendar_block_id as TimeBlockId) : undefined,
    progressEntries,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapTimeBlockNoteRowToDomain(row: TimeBlockNoteRow): TimeBlockNote {
  return {
    id: row.id as TimeBlockNoteId,
    content: row.content,
    durationMinutes: row.duration_minutes,
    kind: row.kind,
    taskProgressEntryId: row.task_progress_entry_id
      ? (row.task_progress_entry_id as TaskProgressEntryId)
      : undefined,
    timerSessionId: row.timer_session_id ? (row.timer_session_id as TimerSessionId) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapTimeBlockRowToDomain(row: TimeBlockRowWithRelations): TimeBlock {
  const notes = sortByUpdatedAtDescending((row.time_block_notes ?? []).map(mapTimeBlockNoteRowToDomain));
  const hasRecurrence =
    row.recurrence_frequency !== null &&
    row.recurrence_end_type !== null &&
    row.recurrence_series_id !== null;

  return {
    id: row.id as TimeBlockId,
    title: row.title,
    description: row.description,
    categoryId: row.category_id as CategoryId,
    tagIds: (row.time_block_tags ?? []).map((link) => link.tag_id as TagId),
    taskId: row.task_id ? (row.task_id as TaskId) : undefined,
    parentBlockId: row.parent_block_id ? (row.parent_block_id as TimeBlockId) : undefined,
    projectId: row.project_id ? (row.project_id as ProjectId) : undefined,
    projectBoundaryType: row.project_boundary_type
      ? (row.project_boundary_type as ProjectBoundaryType)
      : undefined,
    start: new Date(row.start_at),
    end: new Date(row.end_at),
    plannedMinutes: row.planned_minutes,
    actualMinutes: row.actual_minutes,
    source: row.source,
    status: row.status,
    recurrence: hasRecurrence
      ? {
          frequency: row.recurrence_frequency!,
          daysOfWeek: (row.recurrence_days_of_week ?? []) as Array<0 | 1 | 2 | 3 | 4 | 5 | 6>,
          endType: row.recurrence_end_type!,
          until: toDate(row.recurrence_until),
          count: row.recurrence_count ?? undefined,
          exclusionDates: (row.recurrence_exclusion_dates ?? []).map((value) => new Date(value)),
          seriesId: row.recurrence_series_id!,
        }
      : undefined,
    recurrenceIndex: row.recurrence_index ?? undefined,
    googleEventId: row.google_event_id ?? undefined,
    calendarId: row.calendar_id ?? undefined,
    hourlyRate: row.hourly_rate,
    currency: row.currency,
    notes,
  };
}

export function mapTimerSessionRowToDomain(row: TimerSessionRow): TimerSession {
  return {
    id: row.id as TimerSessionId,
    taskId: row.task_id ? (row.task_id as TaskId) : undefined,
    categoryId: row.category_id as CategoryId,
    startTime: new Date(row.start_time),
    endTime: toDate(row.end_time),
    durationMinutes: row.duration_minutes,
    pomodoroMode: row.pomodoro_mode,
    source: row.source,
  };
}

export function mapIntegrationAccountRowToDomain(row: IntegrationAccountRow): IntegrationAccount {
  return {
    id: row.id as IntegrationAccount['id'],
    provider: row.provider,
    status: row.status,
    externalAccountId: row.external_account_id,
    lastSyncedAt: toDate(row.last_synced_at),
  };
}

export function mapTasksToDomain(rows: TaskRowWithRelations[]) {
  return rows.map(mapTaskRowToDomain);
}

export function mapTimeBlocksToDomain(rows: TimeBlockRowWithRelations[]) {
  return sortBlocksByStart(rows.map(mapTimeBlockRowToDomain));
}
