/**
 * Core domain types for TimeTracker.
 *
 * User-facing concepts:
 * - `Task`: work that lives in the task system first.
 * - `TimeBlock`: the calendar surface. In the UI this is shown as a calendar event or a task block.
 * - timer controls: start / stop / done actions that record real work against a task or block.
 *
 * Internal architecture:
 * - A task scheduled onto the calendar is represented by a `TimeBlock` linked through `taskId`
 *   and mirrored task fields like `calendarBlockId`, `scheduledStart`, and `scheduledEnd`.
 * - Timer sessions are stored separately for analytics and integrations, but the UI should not
 *   expose backend names like "TaskScheduleBlock" or "TaskSession".
 * - `plannedMinutes` remains an internal baseline for scheduled-vs-recorded analytics.
 *   User-facing UI should prefer simpler language such as scheduled time, recorded time,
 *   calendar events, and timer controls.
 * - Recurring calendar events are represented as individual `TimeBlock` entries that share
 *   recurrence metadata. This keeps the visible calendar simple while preserving series context
 *   for editing and future Google Calendar sync.
 */

export type CategoryId = string & { readonly __brand: 'CategoryId' };
export type TagId = string & { readonly __brand: 'TagId' };
export type ProjectId = string & { readonly __brand: 'ProjectId' };
export type TaskId = string & { readonly __brand: 'TaskId' };
export type TimeBlockId = string & { readonly __brand: 'TimeBlockId' };
export type TimerSessionId = string & { readonly __brand: 'TimerSessionId' };
export type TaskProgressEntryId = string & { readonly __brand: 'TaskProgressEntryId' };
export type TimeBlockNoteId = string & { readonly __brand: 'TimeBlockNoteId' };
export type IntegrationAccountId = string & { readonly __brand: 'IntegrationAccountId' };
export type UserId = string & { readonly __brand: 'UserId' };

export interface User {
  id: UserId;
  name: string;
  email: string;
  timezone: string;
}

export interface Category {
  id: CategoryId;
  name: string;
  description?: string;
  parentCategoryIds?: CategoryId[];
  color: string; // hex code
  icon: string; // lucide icon name
  active: boolean;
  // Optional default compensation inherited by new calendar events in this category.
  hourlyRate?: number | null;
  currency?: string | null;
}

export interface Tag {
  id: TagId;
  name: string;
  color: string; // hex code
}

export type ProjectStatus = 'active' | 'archived' | 'completed';
export type ProjectBoundaryType = 'start' | 'end';

export interface Project {
  id: ProjectId;
  name: string;
  description: string;
  status: ProjectStatus;
  categoryId: CategoryId;
  startDate?: Date;
  endDate?: Date;
}

export type TaskStatus = 'inbox' | 'next' | 'doing' | 'waiting' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskProgressSource = 'timer' | 'manual' | 'block-note';

export interface TaskProgressEntry {
  id: TaskProgressEntryId;
  timeBlockId?: TimeBlockId;
  timerSessionId?: TimerSessionId;
  startedAt?: Date;
  endedAt?: Date;
  durationMinutes: number;
  note: string;
  source: TaskProgressSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: TaskId;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId?: ProjectId;
  categoryId: CategoryId;
  tagIds: TagId[];
  dueDate?: Date;
  estimatedMinutes?: number;
  // Calendar linkage is internal plumbing for keeping the task and event surfaces in sync.
  scheduledStart?: Date;
  scheduledEnd?: Date;
  actualMinutes: number;
  calendarBlockId?: TimeBlockId;
  progressEntries: TaskProgressEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export type TimeBlockStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
export type TimeBlockSource = 'manual' | 'google-calendar' | 'task' | 'pomodoro';
export type TimeBlockRecurrenceEndType = 'onDate' | 'afterOccurrences';
export type RecurringSeriesScope = 'single' | 'following' | 'all';
export type RecurringDeleteScope = RecurringSeriesScope;
export type RecurringEditScope = RecurringSeriesScope;
export type TimeBlockNoteKind = 'work-note' | 'recap';

export interface TimeBlockRecurrence {
  frequency: 'weekly';
  daysOfWeek: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
  endType: TimeBlockRecurrenceEndType;
  until?: Date;
  count?: number;
  // Exceptions preserve "delete only this event" behavior for recurring calendar events.
  exclusionDates?: Date[];
  seriesId: string;
}

export interface TimeBlockNote {
  id: TimeBlockNoteId;
  content: string;
  durationMinutes: number;
  kind: TimeBlockNoteKind;
  taskProgressEntryId?: TaskProgressEntryId;
  timerSessionId?: TimerSessionId;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeBlock {
  id: TimeBlockId;
  title: string;
  description: string;
  categoryId: CategoryId;
  tagIds: TagId[];
  // When present, this event is acting as a task block on the calendar.
  taskId?: TaskId;
  // Nested task blocks can live inside a parent calendar event.
  parentBlockId?: TimeBlockId;
  // Optional project linkage is used for derived project milestone markers on the calendar.
  projectId?: ProjectId;
  projectBoundaryType?: ProjectBoundaryType;
  start: Date;
  end: Date;
  plannedMinutes: number;
  actualMinutes: number;
  source: TimeBlockSource;
  status: TimeBlockStatus;
  // Series metadata stays internal, but it powers UI actions like deleting one event,
  // deleting this and following, or deleting the entire recurring set.
  recurrence?: TimeBlockRecurrence;
  recurrenceIndex?: number;
  googleEventId?: string;
  calendarId?: string;
  // Optional per-event override; when empty, the UI can inherit from the category.
  hourlyRate?: number | null;
  currency?: string | null;
  notes: TimeBlockNote[];
}

export interface TimerSession {
  id: TimerSessionId;
  // Sessions are internal records that back the visible timer controls and analytics.
  taskId?: TaskId;
  categoryId: CategoryId;
  startTime: Date;
  endTime?: Date;
  durationMinutes: number;
  pomodoroMode: boolean;
  source: 'web' | 'extension';
}

export type IntegrationProvider = 'google-calendar' | 'notion' | 'clockify';
export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

export interface IntegrationAccount {
  id: IntegrationAccountId;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  externalAccountId: string;
  lastSyncedAt?: Date;
}

export interface DashboardStats {
  plannedHours: number;
  actualHours: number;
  completionRate: number;
  topCategory?: Category;
  todayBlocks: TimeBlock[];
  todayTasks: Task[];
  recentSessions: TimerSession[];
  earningsByCurrency: Array<{
    amount: number;
    currency: string;
  }>;
}
