import type {
  Category,
  CategoryId,
  Project,
  ProjectId,
  TagId,
  Task,
  TaskId,
  TimeBlock,
  TimeBlockId,
} from '@/lib/domain/types';
import type {
  CategoryFormValues,
  ProjectFormValues,
  TaskFormValues,
  TimeBlockFormValues,
} from '@/lib/forms/schemas';
import {
  calculateDurationMinutes,
  expandRecurringTimeBlockSeries,
  normalizeCurrency,
} from '@/lib/domain/helpers';

interface TimeBlockBuildOptions {
  compensationDefaults?: {
    hourlyRate?: number | null;
    currency?: string | null;
  };
}

function normalizeOptionalString(value?: string | null) {
  if (typeof value !== 'string') {
    return value ?? undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function createMockId<T extends string>(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}` as T;
}

function normalizeLocalTimeBlockSource(
  taskId: TimeBlockFormValues['taskId'],
  source?: TimeBlock['source']
): TimeBlock['source'] {
  if (source === 'google-calendar' || source === 'pomodoro') {
    return source;
  }

  return taskId ? 'task' : 'manual';
}

export function buildTaskFromFormValues(
  values: TaskFormValues,
  existing?: Partial<Task> | null
): Task {
  const now = new Date();

  return {
    id: (existing?.id ?? createMockId<TaskId>('task')) as TaskId,
    title: values.title,
    description: values.description,
    status: values.status,
    priority: values.priority,
    projectId: normalizeOptionalString(values.projectId) as Task['projectId'],
    categoryId: values.categoryId as Task['categoryId'],
    tagIds: values.tagIds as TagId[],
    dueDate: values.dueDate,
    estimatedMinutes: values.estimatedMinutes,
    scheduledStart: values.scheduledStart ?? existing?.scheduledStart,
    scheduledEnd: values.scheduledEnd ?? existing?.scheduledEnd,
    actualMinutes: values.actualMinutes ?? existing?.actualMinutes ?? 0,
    calendarBlockId:
      (normalizeOptionalString(values.calendarBlockId) as Task['calendarBlockId'] | undefined) ??
      existing?.calendarBlockId,
    progressEntries: existing?.progressEntries ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function buildTimeBlockFromFormValues(
  values: TimeBlockFormValues,
  existing?: Partial<TimeBlock> | null,
  options: TimeBlockBuildOptions = {}
): TimeBlock {
  const normalizedTaskId = normalizeOptionalString(values.taskId) as TimeBlock['taskId'];
  const plannedMinutes = Math.max(calculateDurationMinutes(values.start, values.end), 1);
  const fallbackHourlyRate = options.compensationDefaults?.hourlyRate ?? null;
  const fallbackCurrency =
    options.compensationDefaults?.currency ?? existing?.currency ?? null;
  const hourlyRate = values.hourlyRate ?? fallbackHourlyRate ?? null;
  const currency =
    hourlyRate === null ? null : normalizeCurrency(values.currency ?? fallbackCurrency);
  const normalizedGoogleEventId = normalizeOptionalString(values.googleEventId);
  const normalizedCalendarId = normalizeOptionalString(values.calendarId);

  return {
    id: (existing?.id ?? createMockId<TimeBlockId>('block')) as TimeBlockId,
    title: values.title,
    description: values.description,
    categoryId: values.categoryId as TimeBlock['categoryId'],
    tagIds: values.tagIds as TagId[],
    taskId: normalizedTaskId,
    start: values.start,
    end: values.end,
    plannedMinutes,
    actualMinutes: values.actualMinutes ?? existing?.actualMinutes ?? 0,
    recurrence: values.isRecurring
        ? {
          frequency: 'weekly',
          daysOfWeek: [...new Set(values.recurrenceDays.map((day) => Number(day) as 0 | 1 | 2 | 3 | 4 | 5 | 6))].sort(
            (left, right) => left - right
          ),
          endType: values.recurrenceEndType,
          until: values.recurrenceEndType === 'onDate' ? values.recurrenceUntil : undefined,
          count:
            values.recurrenceEndType === 'afterOccurrences'
              ? values.recurrenceCount
              : undefined,
          exclusionDates: existing?.recurrence?.exclusionDates,
          seriesId:
            existing?.recurrence?.seriesId ??
            createMockId<string>('series'),
        }
      : undefined,
    recurrenceIndex: existing?.recurrenceIndex,
    source: normalizeLocalTimeBlockSource(normalizedTaskId, values.source ?? existing?.source),
    status: values.status ?? existing?.status ?? 'scheduled',
    googleEventId: normalizedGoogleEventId ?? existing?.googleEventId,
    calendarId: normalizedCalendarId ?? existing?.calendarId,
    hourlyRate,
    currency,
    notes: existing?.notes ?? [],
  };
}

export function buildTimeBlockSeriesFromFormValues(
  values: TimeBlockFormValues,
  existing?: Partial<TimeBlock> | null,
  options: TimeBlockBuildOptions = {}
): TimeBlock[] {
  const baseBlock = buildTimeBlockFromFormValues(values, existing, options);

  if (!baseBlock.recurrence) {
    return [baseBlock];
  }

  if (existing?.recurrence?.seriesId) {
    return [baseBlock];
  }

  return expandRecurringTimeBlockSeries(baseBlock).map((block, index) =>
    index === 0
      ? block
      : {
          ...block,
          id: createMockId<TimeBlockId>('block'),
        }
  );
}

export function buildCategoryFromFormValues(
  values: CategoryFormValues,
  existing?: Partial<Category> | null
): Category {
  const hourlyRate = values.hourlyRate ?? null;
  const currency = hourlyRate === null ? null : normalizeCurrency(values.currency);
  const parentCategoryIds = [...new Set(values.parentCategoryIds.map((id) => id as CategoryId))]
    .filter((id) => id !== existing?.id);

  return {
    id: (existing?.id ?? createMockId<CategoryId>('cat')) as CategoryId,
    name: values.name,
    description: values.description || undefined,
    parentCategoryIds,
    color: values.color,
    icon: values.icon,
    active: values.active,
    hourlyRate,
    currency,
  };
}

export function buildProjectFromFormValues(
  values: ProjectFormValues,
  existing?: Partial<Project> | null
): Project {
  return {
    id: (existing?.id ?? createMockId<ProjectId>('proj')) as ProjectId,
    name: values.name,
    description: values.description,
    status: values.status,
    categoryId: values.categoryId as Project['categoryId'],
    startDate: values.startDate,
    endDate: values.endDate,
  };
}
