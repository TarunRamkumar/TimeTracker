import { Category, CategoryId, ProjectId, TagId } from './types';

// Helper functions to create branded IDs
export function createCategoryId(id: string): CategoryId {
  return id as CategoryId;
}

export function createTagId(id: string): TagId {
  return id as TagId;
}

export function createProjectId(id: string): ProjectId {
  return id as ProjectId;
}

export const CATEGORY_COLORS = {
  work: '#3B82F6',      // blue
  sports: '#10B981',    // green
  internship: '#8B5CF6', // purple
  study: '#F59E0B',     // amber
  personal: '#F97316',  // orange
  social: '#EC4899',    // pink
} as const;

export const CATEGORY_ICONS = {
  work: 'briefcase',
  sports: 'activity',
  internship: 'book-open',
  study: 'book',
  personal: 'heart',
  social: 'users',
} as const;

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: createCategoryId('cat-work'),
    name: 'Work',
    color: CATEGORY_COLORS.work,
    icon: CATEGORY_ICONS.work,
    active: true,
  },
  {
    id: createCategoryId('cat-sports'),
    name: 'Sports',
    parentCategoryIds: [createCategoryId('cat-personal')],
    color: CATEGORY_COLORS.sports,
    icon: CATEGORY_ICONS.sports,
    active: true,
  },
  {
    id: createCategoryId('cat-internship'),
    name: 'Internship',
    parentCategoryIds: [createCategoryId('cat-work')],
    color: CATEGORY_COLORS.internship,
    icon: CATEGORY_ICONS.internship,
    active: true,
    hourlyRate: 25,
    currency: 'USD',
  },
  {
    id: createCategoryId('cat-study'),
    name: 'Study',
    color: CATEGORY_COLORS.study,
    icon: CATEGORY_ICONS.study,
    active: true,
  },
  {
    id: createCategoryId('cat-personal'),
    name: 'Personal',
    color: CATEGORY_COLORS.personal,
    icon: CATEGORY_ICONS.personal,
    active: true,
  },
  {
    id: createCategoryId('cat-social'),
    name: 'Social',
    parentCategoryIds: [createCategoryId('cat-personal')],
    color: CATEGORY_COLORS.social,
    icon: CATEGORY_ICONS.social,
    active: true,
  },
];

export const TASK_STATUSES = ['inbox', 'next', 'doing', 'waiting', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

export const STATUS_LABELS = {
  inbox: 'Inbox',
  next: 'Next',
  doing: 'Doing',
  waiting: 'Waiting',
  done: 'Done',
} as const;

export const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
} as const;

export const INTEGRATION_PROVIDERS = ['google-calendar', 'notion', 'clockify'] as const;

export const TIMER_PRESETS = {
  shortBreak: 5,
  longBreak: 15,
  pomodoro: 25,
} as const;
