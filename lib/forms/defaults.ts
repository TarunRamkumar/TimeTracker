import { endOfWeek, format } from 'date-fns';
import type { Category, Project, Task, TimeBlock } from '@/lib/domain/types';
import { CATEGORY_COLORS } from '@/lib/domain/constants';
import { calculateDurationMinutes } from '@/lib/domain/helpers';
import type {
  CategoryFormInput,
  ProjectFormInput,
  TaskFormInput,
  TimeBlockFormInput,
} from '@/lib/forms/schemas';

const CATEGORY_FORM_COLOR_OPTIONS = [
  ...new Set([
    ...Object.values(CATEGORY_COLORS),
    '#06B6D4',
    '#14B8A6',
    '#22C55E',
    '#84CC16',
    '#EAB308',
    '#F43F5E',
    '#D946EF',
  ]),
];

function getRandomCategoryFormColor() {
  const index = Math.floor(Math.random() * CATEGORY_FORM_COLOR_OPTIONS.length);
  return CATEGORY_FORM_COLOR_OPTIONS[index] ?? '#3B82F6';
}

export function toDateInputValue(date?: Date) {
  return date ? format(date, 'yyyy-MM-dd') : '';
}

export function toDateTimeInputValue(date?: Date) {
  return date ? format(date, "yyyy-MM-dd'T'HH:mm") : '';
}

export function getTaskFormDefaults(initialData?: Partial<Task> | null): TaskFormInput {
  return {
    title: initialData?.title ?? '',
    description: initialData?.description ?? '',
    status: initialData?.status ?? 'inbox',
    priority: initialData?.priority ?? 'medium',
    projectId: initialData?.projectId ?? '',
    categoryId: initialData?.categoryId ?? '',
    tagIds: initialData?.tagIds ?? [],
    dueDate: toDateInputValue(initialData?.dueDate),
    estimatedMinutes: initialData?.estimatedMinutes ?? '',
    scheduledStart: toDateTimeInputValue(initialData?.scheduledStart),
    scheduledEnd: toDateTimeInputValue(initialData?.scheduledEnd),
    actualMinutes: initialData?.actualMinutes ?? '',
    calendarBlockId: initialData?.calendarBlockId ?? '',
  };
}

export function getTimeBlockFormDefaults(initialData?: Partial<TimeBlock> | null): TimeBlockFormInput {
  const defaultStart = initialData?.start ?? new Date();
  const defaultEnd = initialData?.end ?? new Date(defaultStart.getTime() + 60 * 60 * 1000);
  const defaultRepeatUntil =
    initialData?.recurrence?.until ?? endOfWeek(defaultStart, { weekStartsOn: 1 });

  return {
    title: initialData?.title ?? '',
    description: initialData?.description ?? '',
    categoryId: initialData?.categoryId ?? '',
    tagIds: initialData?.tagIds ?? [],
    taskId: initialData?.taskId ?? '',
    start: toDateTimeInputValue(defaultStart),
    end: toDateTimeInputValue(defaultEnd),
    plannedMinutes: initialData?.plannedMinutes ?? calculateDurationMinutes(defaultStart, defaultEnd),
    actualMinutes: initialData?.actualMinutes ?? '',
    hourlyRate: initialData?.hourlyRate ?? '',
    currency: initialData?.currency ?? '',
    isRecurring: Boolean(initialData?.recurrence),
    recurrenceDays:
      (initialData?.recurrence?.daysOfWeek.map(String) as Array<'0' | '1' | '2' | '3' | '4' | '5' | '6'> | undefined) ??
      [String(defaultStart.getDay()) as '0' | '1' | '2' | '3' | '4' | '5' | '6'],
    recurrenceEndType: initialData?.recurrence?.endType ?? 'onDate',
    recurrenceUntil: toDateInputValue(defaultRepeatUntil),
    recurrenceCount: initialData?.recurrence?.count ?? 5,
    source: initialData?.source ?? 'manual',
    status: initialData?.status ?? 'scheduled',
    googleEventId: initialData?.googleEventId ?? '',
    calendarId: initialData?.calendarId ?? '',
  };
}

export function getCategoryFormDefaults(initialData?: Partial<Category> | null): CategoryFormInput {
  return {
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    color: initialData?.color ?? getRandomCategoryFormColor(),
    parentCategoryIds: initialData?.parentCategoryIds ?? [],
    icon: initialData?.icon ?? 'briefcase',
    hourlyRate: initialData?.hourlyRate ?? '',
    currency: initialData?.currency ?? '',
    active: initialData?.active ?? true,
  };
}

export function getProjectFormDefaults(initialData?: Partial<Project> | null): ProjectFormInput {
  return {
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    status: initialData?.status ?? 'active',
    categoryId: initialData?.categoryId ?? '',
    startDate: toDateInputValue(initialData?.startDate),
    endDate: toDateInputValue(initialData?.endDate),
  };
}
