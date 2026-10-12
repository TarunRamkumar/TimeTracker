'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { add, isBefore, startOfDay } from 'date-fns';
import { DEFAULT_CATEGORIES } from '@/lib/domain/constants';
import {
  hydrateProjects,
  serializeProjects,
  serializeAppDataState,
  type ActiveTimerState,
  type AppDataState,
  type PersistedAppData,
} from '@/lib/app-data/serialization';
import {
  applyTimeBlockDeleteScope,
  calculateDurationMinutes,
  getChildTimeBlocks,
  getTimeBlockActualMinutes,
  getTimeBlockPlannedMinutes,
  isCompletedCalendarEvent,
  isProjectBoundaryBlock,
} from '@/lib/domain/helpers';
import type {
  Project,
  ProjectBoundaryType,
  ProjectId,
  RecurringDeleteScope,
  Tag,
  Task,
  TaskProgressEntry,
  TaskProgressEntryId,
  TaskId,
  TimeBlock,
  TimeBlockId,
  TimeBlockNote,
  TimerSession,
  TimerSessionId,
} from '@/lib/domain/types';
import { MOCK_TASKS, MOCK_TAGS, MOCK_PROJECTS } from '@/lib/mock/tasks';
import { MOCK_TIME_BLOCKS } from '@/lib/mock/time-blocks';
import { MOCK_TIMER_SESSIONS } from '@/lib/mock/sessions';

const STORAGE_KEY = 'timetracker-app-data-v1';
const PROJECTS_STORAGE_KEY = 'timetracker-projects-v1';
const PROJECT_BOUNDARY_DURATION_MINUTES = 5;
const PROJECT_BOUNDARY_HOURS: Record<ProjectBoundaryType, number> = {
  start: 9,
  end: 17,
};

interface AddTimeBlockNoteInput {
  content: string;
  durationMinutes?: number;
  kind?: TimeBlockNote['kind'];
}

interface StopTimerOptions {
  completeTask?: boolean;
}

interface UpsertTimeBlockOptions {
  preservePlannedMinutes?: boolean;
  syncActualMinutesFromRange?: boolean;
}

interface DeleteTimeBlockOptions {
  scope?: RecurringDeleteScope;
}

interface AppDataContextValue {
  tasks: Task[];
  timeBlocks: TimeBlock[];
  timerSessions: TimerSession[];
  projects: Project[];
  tags: Tag[];
  activeTimer: ActiveTimerState | null;
  isTimerRunning: boolean;
  activeTask?: Task;
  activeTimeBlock?: TimeBlock;
  activeElapsedSeconds: number;
  activeElapsedLabel: string;
  upsertProject: (project: Project) => void;
  deleteProject: (projectId: ProjectId) => void;
  upsertTask: (task: Task) => void;
  deleteTask: (taskId: TaskId) => void;
  upsertTimeBlock: (block: TimeBlock, options?: UpsertTimeBlockOptions) => void;
  upsertTimeBlocks: (blocks: TimeBlock[], options?: UpsertTimeBlockOptions) => void;
  deleteTimeBlock: (blockId: TimeBlockId, options?: DeleteTimeBlockOptions) => void;
  addTimeBlockNote: (blockId: TimeBlockId, input: AddTimeBlockNoteInput) => void;
  scheduleTaskOnCalendar: (taskId: TaskId) => void;
  startTimer: (taskId?: TaskId, blockId?: TimeBlockId) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: (options?: StopTimerOptions) => void;
  resetTimer: () => void;
  completeTask: (taskId: TaskId, actualMinutes?: number) => void;
  formatElapsedTime: (seconds: number) => string;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function createLocalId<T extends string>(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}` as T;
}

function sortBlocks(blocks: TimeBlock[]) {
  return [...blocks].sort((left, right) => left.start.getTime() - right.start.getTime());
}

function sortProjects(projects: Project[]) {
  return [...projects].sort((left, right) => left.name.localeCompare(right.name));
}

function getProjectBoundaryDate(project: Project, boundaryType: ProjectBoundaryType) {
  return boundaryType === 'start' ? project.startDate : project.endDate;
}

function getProjectBoundaryTitle(project: Project, boundaryType: ProjectBoundaryType) {
  return `${boundaryType === 'start' ? 'Start' : 'End'}: ${project.name}`;
}

function getProjectBoundaryDescription(project: Project, boundaryType: ProjectBoundaryType) {
  const actionLabel = boundaryType === 'start' ? 'Project kickoff' : 'Project completion target';

  return project.description
    ? `${actionLabel} for ${project.name}. ${project.description}`
    : `${actionLabel} for ${project.name}.`;
}

function getProjectBoundaryStart(date: Date, boundaryType: ProjectBoundaryType) {
  const boundaryStart = startOfDay(date);
  boundaryStart.setHours(PROJECT_BOUNDARY_HOURS[boundaryType], 0, 0, 0);
  return boundaryStart;
}

function buildProjectBoundaryBlock(
  project: Project,
  boundaryType: ProjectBoundaryType,
  existing?: TimeBlock
): TimeBlock | null {
  const boundaryDate = getProjectBoundaryDate(project, boundaryType);
  if (!boundaryDate) {
    return null;
  }

  const start = getProjectBoundaryStart(boundaryDate, boundaryType);
  const end = add(start, { minutes: PROJECT_BOUNDARY_DURATION_MINUTES });
  const isPast = end.getTime() <= Date.now();

  return {
    id: existing?.id ?? createLocalId<TimeBlockId>('block'),
    title: getProjectBoundaryTitle(project, boundaryType),
    description: getProjectBoundaryDescription(project, boundaryType),
    categoryId: project.categoryId,
    tagIds: [],
    taskId: undefined,
    projectId: project.id,
    projectBoundaryType: boundaryType,
    start,
    end,
    plannedMinutes: isPast ? 0 : PROJECT_BOUNDARY_DURATION_MINUTES,
    actualMinutes: isPast ? PROJECT_BOUNDARY_DURATION_MINUTES : 0,
    source: 'manual',
    status: isPast ? 'completed' : 'scheduled',
    recurrence: undefined,
    recurrenceIndex: undefined,
    googleEventId: undefined,
    calendarId: undefined,
    hourlyRate: null,
    currency: null,
    notes: existing?.notes ?? [],
  };
}

function reconcileProjectBoundaryBlocks(timeBlocks: TimeBlock[], projects: Project[]) {
  const boundaryBlocksByKey = new Map<string, TimeBlock>();

  timeBlocks.forEach((block) => {
    if (!isProjectBoundaryBlock(block)) {
      return;
    }

    boundaryBlocksByKey.set(`${block.projectId}:${block.projectBoundaryType}`, block);
  });

  const nextBlocks = timeBlocks.filter((block) => !isProjectBoundaryBlock(block));

  projects.forEach((project) => {
    (['start', 'end'] as const).forEach((boundaryType) => {
      const nextBoundaryBlock = buildProjectBoundaryBlock(
        project,
        boundaryType,
        boundaryBlocksByKey.get(`${project.id}:${boundaryType}`)
      );

      if (nextBoundaryBlock) {
        nextBlocks.push(nextBoundaryBlock);
      }
    });
  });

  return sortBlocks(nextBlocks);
}

function getRoundedNow() {
  const now = new Date();
  now.setSeconds(0, 0);

  const remainder = now.getMinutes() % 5;
  now.setMinutes(now.getMinutes() - remainder);

  return now;
}

function getNextScheduleSlot(task: Task) {
  const duration = task.estimatedMinutes ?? 60;
  const preferredAnchor = task.scheduledStart
    ? add(task.scheduledStart, { days: 1 })
    : task.dueDate ?? add(startOfDay(new Date()), { days: 1 });
  const anchorDay = startOfDay(preferredAnchor);
  const hourOffset = task.priority === 'high' ? 9 : task.priority === 'medium' ? 13 : 16;

  let start = add(anchorDay, { hours: hourOffset });
  if (isBefore(start, new Date())) {
    start = add(startOfDay(new Date()), { days: 1, hours: hourOffset });
  }

  return {
    start,
    end: add(start, { minutes: duration }),
  };
}

function formatElapsedTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
      remainingSeconds
    ).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getElapsedSeconds(timer: ActiveTimerState | null) {
  if (!timer) {
    return 0;
  }

  if (!timer.isRunning) {
    return timer.elapsedSeconds;
  }

  return Math.max(
    timer.elapsedSeconds,
    Math.floor((Date.now() - timer.startedAt.getTime()) / 1000)
  );
}

function autoCompletePastCalendarEvents(
  timeBlocks: TimeBlock[],
  activeTimer: ActiveTimerState | null,
  now = new Date()
) {
  let changed = false;

  const nextBlocks = timeBlocks.map((block) => {
    if (activeTimer?.blockId === block.id) {
      return block;
    }

    if (!isCompletedCalendarEvent(block, now)) {
      return block;
    }

    const actualMinutes = getTimeBlockActualMinutes(block, now);
    const plannedMinutes = getTimeBlockPlannedMinutes(block, now);

    if (
      block.status === 'completed' &&
      block.actualMinutes === actualMinutes &&
      block.plannedMinutes === plannedMinutes
    ) {
      return block;
    }

    changed = true;
    return {
      ...block,
      plannedMinutes,
      actualMinutes,
      status: 'completed' as const,
    };
  });

  return changed ? sortBlocks(nextBlocks) : timeBlocks;
}

function hydrateState(value: PersistedAppData | null): AppDataState {
  if (!value) {
    const initialState = {
      tasks: MOCK_TASKS,
      timeBlocks: MOCK_TIME_BLOCKS,
      timerSessions: MOCK_TIMER_SESSIONS,
      activeTimer: null,
    };

    return {
      ...initialState,
      timeBlocks: autoCompletePastCalendarEvents(initialState.timeBlocks, initialState.activeTimer),
    };
  }

  const hydratedState = {
    tasks: value.tasks.map((task) => ({
      ...task,
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
      scheduledStart: task.scheduledStart ? new Date(task.scheduledStart) : undefined,
      scheduledEnd: task.scheduledEnd ? new Date(task.scheduledEnd) : undefined,
      progressEntries: (task.progressEntries ?? []).map((entry) => ({
        ...entry,
        startedAt: entry.startedAt ? new Date(entry.startedAt) : undefined,
        endedAt: entry.endedAt ? new Date(entry.endedAt) : undefined,
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt),
      })),
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt),
    })),
    timeBlocks: sortBlocks(
      value.timeBlocks.map((block) => ({
        ...block,
        start: new Date(block.start),
        end: new Date(block.end),
        notes: (block.notes ?? []).map((note) => ({
          ...note,
          createdAt: new Date(note.createdAt),
          updatedAt: new Date(note.updatedAt),
        })),
        recurrence: block.recurrence
          ? {
              ...block.recurrence,
              until: block.recurrence.until ? new Date(block.recurrence.until) : undefined,
              exclusionDates: block.recurrence.exclusionDates?.map((date) => new Date(date)),
            }
          : undefined,
      }))
    ),
    timerSessions: value.timerSessions.map((session) => ({
      ...session,
      startTime: new Date(session.startTime),
      endTime: session.endTime ? new Date(session.endTime) : undefined,
    })),
    activeTimer: value.activeTimer
      ? {
          ...value.activeTimer,
          startedAt: new Date(value.activeTimer.startedAt),
        }
      : null,
  };

  return {
    ...hydratedState,
    timeBlocks: autoCompletePastCalendarEvents(
      hydratedState.timeBlocks,
      hydratedState.activeTimer
    ),
  };
}

function getInitialState(initialDataJson?: string, preferLocalStateOnBoot = false) {
  if (typeof window === 'undefined') {
    if (initialDataJson) {
      try {
        return hydrateState(JSON.parse(initialDataJson) as PersistedAppData);
      } catch {
        return hydrateState(null);
      }
    }

    return hydrateState(null);
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);

  if (preferLocalStateOnBoot && storedValue) {
    try {
      return hydrateState(JSON.parse(storedValue) as PersistedAppData);
    } catch {
      // Fall back to the server bootstrap snapshot.
    }
  }

  if (initialDataJson) {
    try {
      return hydrateState(JSON.parse(initialDataJson) as PersistedAppData);
    } catch {
      return hydrateState(null);
    }
  }

  if (!storedValue) {
    return hydrateState(null);
  }

  try {
    return hydrateState(JSON.parse(storedValue) as PersistedAppData);
  } catch {
    return hydrateState(null);
  }
}

function getInitialProjects(initialProjects: Project[], preferLocalStateOnBoot = false) {
  if (typeof window === 'undefined') {
    return sortProjects(hydrateProjects(initialProjects));
  }

  const storedValue = window.localStorage.getItem(PROJECTS_STORAGE_KEY);

  if (preferLocalStateOnBoot && storedValue) {
    try {
      const parsed = JSON.parse(storedValue) as Project[];
      return Array.isArray(parsed)
        ? sortProjects(hydrateProjects(parsed))
        : sortProjects(hydrateProjects(initialProjects));
    } catch {
      return sortProjects(hydrateProjects(initialProjects));
    }
  }

  if (initialProjects) {
    return sortProjects(hydrateProjects(initialProjects));
  }

  if (!storedValue) {
    return sortProjects(MOCK_PROJECTS);
  }

  try {
    const parsed = JSON.parse(storedValue) as Project[];
    return Array.isArray(parsed)
      ? sortProjects(hydrateProjects(parsed))
      : sortProjects(hydrateProjects(MOCK_PROJECTS));
  } catch {
    return sortProjects(hydrateProjects(MOCK_PROJECTS));
  }
}

function replaceTask(tasks: Task[], nextTask: Task) {
  const exists = tasks.some((task) => task.id === nextTask.id);
  if (!exists) {
    return [nextTask, ...tasks];
  }

  return tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
}

function replaceProject(projects: Project[], nextProject: Project) {
  const exists = projects.some((project) => project.id === nextProject.id);
  if (!exists) {
    return sortProjects([...projects, nextProject]);
  }

  return sortProjects(
    projects.map((project) => (project.id === nextProject.id ? nextProject : project))
  );
}

function replaceTimeBlock(timeBlocks: TimeBlock[], nextBlock: TimeBlock) {
  const exists = timeBlocks.some((block) => block.id === nextBlock.id);
  if (!exists) {
    return sortBlocks([...timeBlocks, nextBlock]);
  }

  return sortBlocks(
    timeBlocks.map((block) => (block.id === nextBlock.id ? nextBlock : block))
  );
}

function replaceTimeBlocks(timeBlocks: TimeBlock[], nextBlocks: TimeBlock[]) {
  return nextBlocks.reduce((currentBlocks, nextBlock) => replaceTimeBlock(currentBlocks, nextBlock), timeBlocks);
}

function shouldPreservePlannedMinutes(previousBlock: TimeBlock | undefined, nextBlock: TimeBlock) {
  if (!previousBlock) {
    return false;
  }

  return (
    previousBlock.start.getTime() === nextBlock.start.getTime() &&
    previousBlock.end.getTime() === nextBlock.end.getTime()
  );
}

function syncTaskWithProject(task: Task, projects: Project[]) {
  if (!task.projectId) {
    return task;
  }

  const project = projects.find((item) => item.id === task.projectId);
  if (!project) {
    return {
      ...task,
      projectId: undefined,
    };
  }

  if (task.categoryId === project.categoryId) {
    return task;
  }

  return {
    ...task,
    categoryId: project.categoryId,
  };
}

function collectNestedChildBlockIds(timeBlocks: TimeBlock[], parentBlockIds: Set<TimeBlockId>) {
  const nestedIds = new Set<TimeBlockId>();
  let changed = true;

  while (changed) {
    changed = false;

    timeBlocks.forEach((block) => {
      if (!block.parentBlockId) {
        return;
      }

      if (!parentBlockIds.has(block.parentBlockId) && !nestedIds.has(block.parentBlockId)) {
        return;
      }

      if (nestedIds.has(block.id)) {
        return;
      }

      nestedIds.add(block.id);
      changed = true;
    });
  }

  return nestedIds;
}

function clampChildBlockToParentRange(childBlock: TimeBlock, parentBlock: TimeBlock): TimeBlock {
  const durationMinutes = Math.min(
    Math.max(calculateDurationMinutes(childBlock.start, childBlock.end), 1),
    Math.max(calculateDurationMinutes(parentBlock.start, parentBlock.end), 1)
  );
  const durationMs = durationMinutes * 60 * 1000;
  const parentStartMs = parentBlock.start.getTime();
  const parentEndMs = parentBlock.end.getTime();
  let nextStartMs = Math.max(childBlock.start.getTime(), parentStartMs);

  if (nextStartMs + durationMs > parentEndMs) {
    nextStartMs = Math.max(parentStartMs, parentEndMs - durationMs);
  }

  return {
    ...childBlock,
    start: new Date(nextStartMs),
    end: new Date(nextStartMs + durationMs),
    actualMinutes:
      childBlock.actualMinutes > 0 ? Math.min(childBlock.actualMinutes, durationMinutes) : childBlock.actualMinutes,
  };
}

function syncNestedChildrenWithParentChange(
  timeBlocks: TimeBlock[],
  previousParentBlock: TimeBlock | undefined,
  nextParentBlock: TimeBlock
) {
  if (!previousParentBlock) {
    return timeBlocks;
  }

  const childBlocks = getChildTimeBlocks(timeBlocks, nextParentBlock.id);
  if (childBlocks.length === 0) {
    return timeBlocks;
  }

  const startDeltaMs = nextParentBlock.start.getTime() - previousParentBlock.start.getTime();
  const parentRangeChanged =
    nextParentBlock.start.getTime() !== previousParentBlock.start.getTime() ||
    nextParentBlock.end.getTime() !== previousParentBlock.end.getTime();

  if (!parentRangeChanged) {
    return timeBlocks;
  }

  const nextChildBlocks = childBlocks.map((childBlock) => {
    const shiftedBlock = {
      ...childBlock,
      start: new Date(childBlock.start.getTime() + startDeltaMs),
      end: new Date(childBlock.end.getTime() + startDeltaMs),
    };

    return clampChildBlockToParentRange(shiftedBlock, nextParentBlock);
  });

  return replaceTimeBlocks(timeBlocks, nextChildBlocks);
}

function resolveCompletedTimeBlock(
  block: TimeBlock,
  nextActualMinutes: number,
  timeBlocks: TimeBlock[],
  status: TimeBlock['status']
) {
  if (!block.parentBlockId) {
    return {
      ...block,
      actualMinutes: nextActualMinutes,
      end: add(block.start, { minutes: Math.max(nextActualMinutes, 1) }),
      status,
    };
  }

  const parentBlock = timeBlocks.find((item) => item.id === block.parentBlockId);
  if (!parentBlock) {
    return {
      ...block,
      actualMinutes: nextActualMinutes,
      end: add(block.start, { minutes: Math.max(nextActualMinutes, 1) }),
      status,
    };
  }

  const maxVisibleMinutes = Math.max(calculateDurationMinutes(block.start, parentBlock.end), 1);
  const clampedActualMinutes = Math.min(Math.max(nextActualMinutes, 1), maxVisibleMinutes);

  return {
    ...block,
    actualMinutes: clampedActualMinutes,
    end: add(block.start, { minutes: clampedActualMinutes }),
    status,
  };
}

function syncBlockWithTask(block: TimeBlock, task?: Task): TimeBlock {
  if (!task) {
    return block;
  }

  return {
    ...block,
    title: task.title,
    description: task.description,
    categoryId: task.categoryId,
    tagIds: task.tagIds,
    source:
      block.source === 'google-calendar' || block.source === 'pomodoro'
        ? block.source
        : ('task' as const),
  };
}

function createTaskProgressEntry(
  input: Omit<TaskProgressEntry, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: TaskProgressEntryId;
    createdAt?: Date;
    updatedAt?: Date;
  }
): TaskProgressEntry {
  const createdAt = input.createdAt ?? new Date();

  return {
    id: input.id ?? createLocalId<TaskProgressEntryId>('task-progress'),
    timeBlockId: input.timeBlockId,
    timerSessionId: input.timerSessionId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMinutes: input.durationMinutes,
    note: input.note,
    source: input.source,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
  };
}

function appendTaskProgressEntry(task: Task, entry: TaskProgressEntry): Task {
  return {
    ...task,
    progressEntries: [entry, ...(task.progressEntries ?? [])],
    updatedAt: entry.updatedAt,
  };
}

function replaceTaskProgressEntry(
  task: Task,
  entryId: TaskProgressEntryId,
  nextEntry: TaskProgressEntry
): Task {
  return {
    ...task,
    progressEntries: (task.progressEntries ?? []).map((entry) =>
      entry.id === entryId ? nextEntry : entry
    ),
    updatedAt: nextEntry.updatedAt,
  };
}

function createTimeBlockNote(
  input: Omit<TimeBlockNote, 'id' | 'createdAt' | 'updatedAt'> & {
    createdAt?: Date;
    updatedAt?: Date;
  }
): TimeBlockNote {
  const createdAt = input.createdAt ?? new Date();

  return {
    id: createLocalId<TimeBlockNote['id']>('block-note'),
    content: input.content,
    durationMinutes: input.durationMinutes,
    kind: input.kind,
    taskProgressEntryId: input.taskProgressEntryId,
    timerSessionId: input.timerSessionId,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
  };
}

function getDefaultBlockNoteDuration(block: TimeBlock) {
  const actualMinutes = getTimeBlockActualMinutes(block);
  if (actualMinutes > 0) {
    return actualMinutes;
  }

  return Math.max(calculateDurationMinutes(block.start, block.end), 1);
}

function normalizeTimeBlockSource(block: Pick<TimeBlock, 'taskId' | 'source'>): TimeBlock['source'] {
  if (block.source === 'google-calendar' || block.source === 'pomodoro') {
    return block.source;
  }

  return block.taskId ? 'task' : 'manual';
}

function getPrimaryTaskBlock(timeBlocks: TimeBlock[], taskId: TaskId, now = new Date()) {
  const linkedBlocks = sortBlocks(
    timeBlocks.filter((block) => block.taskId === taskId && block.status !== 'cancelled')
  );

  if (linkedBlocks.length === 0) {
    return undefined;
  }

  const upcomingBlock = linkedBlocks.find((block) => block.end.getTime() >= now.getTime());
  if (upcomingBlock) {
    return upcomingBlock;
  }

  return linkedBlocks[linkedBlocks.length - 1];
}

function syncTasksForBlockChange(
  tasks: Task[],
  timeBlocks: TimeBlock[],
  previousBlock: TimeBlock | undefined,
  nextBlock?: TimeBlock
) {
  const now = new Date();
  const affectedTaskIds = new Set<TaskId>();

  if (previousBlock?.taskId) {
    affectedTaskIds.add(previousBlock.taskId);
  }

  if (nextBlock?.taskId) {
    affectedTaskIds.add(nextBlock.taskId);
  }

  return tasks.map((task) => {
    if (!affectedTaskIds.has(task.id)) {
      return task;
    }

    const primaryBlock = getPrimaryTaskBlock(timeBlocks, task.id, now);

    if (!primaryBlock) {
      return {
        ...task,
        scheduledStart: undefined,
        scheduledEnd: undefined,
        calendarBlockId: undefined,
        updatedAt: now,
      };
    }

    return {
      ...task,
      scheduledStart: primaryBlock.start,
      scheduledEnd: primaryBlock.end,
      calendarBlockId: primaryBlock.id,
      status: task.status === 'inbox' ? 'next' : task.status,
      updatedAt: now,
    };
  });
}

function syncTasksForNestedChildChanges(
  tasks: Task[],
  previousTimeBlocks: TimeBlock[],
  nextTimeBlocks: TimeBlock[],
  parentBlockId: TimeBlockId
) {
  const previousChildBlocks = getChildTimeBlocks(previousTimeBlocks, parentBlockId);
  const nextChildBlocks = getChildTimeBlocks(nextTimeBlocks, parentBlockId);
  const childBlockIds = new Set<TimeBlockId>([
    ...previousChildBlocks.map((block) => block.id),
    ...nextChildBlocks.map((block) => block.id),
  ]);
  let nextTasks = tasks;

  childBlockIds.forEach((childBlockId) => {
    const previousChildBlock = previousChildBlocks.find((block) => block.id === childBlockId);
    const nextChildBlock = nextChildBlocks.find((block) => block.id === childBlockId);
    nextTasks = syncTasksForBlockChange(nextTasks, nextTimeBlocks, previousChildBlock, nextChildBlock);
  });

  return nextTasks;
}

function buildTaskBlock(task: Task, overrides?: Partial<TimeBlock>): TimeBlock {
  const fallbackSlot = getNextScheduleSlot(task);
  const start = overrides?.start ?? fallbackSlot.start;
  const end = overrides?.end ?? fallbackSlot.end;

  return {
    id: (overrides?.id ?? createLocalId<TimeBlockId>('block')) as TimeBlockId,
    title: overrides?.title ?? task.title,
    description: overrides?.description ?? task.description,
    categoryId: overrides?.categoryId ?? task.categoryId,
    tagIds: overrides?.tagIds ?? task.tagIds,
    taskId: overrides?.taskId ?? task.id,
    parentBlockId: overrides?.parentBlockId,
    start,
    end,
    plannedMinutes:
      overrides?.plannedMinutes ?? calculateDurationMinutes(start, end) ?? task.estimatedMinutes ?? 60,
    actualMinutes: overrides?.actualMinutes ?? 0,
    source: overrides?.source ?? 'task',
    status: overrides?.status ?? 'scheduled',
    googleEventId: overrides?.googleEventId,
    calendarId: overrides?.calendarId,
    notes: overrides?.notes ?? [],
  };
}

function finalizeActiveTimer(
  previousState: AppDataState,
  options: StopTimerOptions = {}
): AppDataState {
  if (!previousState.activeTimer) {
    return previousState;
  }

  const timer = previousState.activeTimer;
  const elapsedSeconds = getElapsedSeconds(timer);
  const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
  const endTime = new Date();
  const now = new Date();

  let nextTasks = previousState.tasks;
  let nextBlocks = previousState.timeBlocks;
  let recordedDurationMinutes = durationMinutes;

  const currentTask = timer.taskId
    ? previousState.tasks.find((task) => task.id === timer.taskId)
    : undefined;
  const currentBlock = timer.blockId
    ? previousState.timeBlocks.find((block) => block.id === timer.blockId)
    : undefined;

  if (currentBlock) {
    const nextActualMinutes = currentBlock.actualMinutes + durationMinutes;
    const nextBlock = resolveCompletedTimeBlock(
      currentBlock,
      nextActualMinutes,
      previousState.timeBlocks,
      options.completeTask ? 'completed' : 'scheduled'
    );
    recordedDurationMinutes = Math.max(nextBlock.actualMinutes - currentBlock.actualMinutes, 0);

    nextBlocks = replaceTimeBlock(nextBlocks, nextBlock);
    nextTasks = syncTasksForBlockChange(nextTasks, nextBlocks, currentBlock, nextBlock);
  }

  const session: TimerSession = {
    id: timer.id,
    taskId: timer.taskId,
    categoryId: timer.categoryId,
    startTime: timer.startedAt,
    endTime,
    durationMinutes: recordedDurationMinutes,
    pomodoroMode: timer.pomodoroMode,
    source: 'web',
  };

  if (currentTask && recordedDurationMinutes > 0) {
    const syncedTask = nextTasks.find((task) => task.id === currentTask.id) ?? currentTask;
    const progressEntry = createTaskProgressEntry({
      timeBlockId: currentBlock?.id,
      timerSessionId: session.id,
      startedAt: timer.startedAt,
      endedAt: endTime,
      durationMinutes: recordedDurationMinutes,
      note: '',
      source: 'timer',
      createdAt: endTime,
      updatedAt: endTime,
    });
    const nextTask = appendTaskProgressEntry(
      {
        ...syncedTask,
        actualMinutes: syncedTask.actualMinutes + recordedDurationMinutes,
        status: options.completeTask ? ('done' as const) : ('doing' as const),
        updatedAt: now,
      },
      progressEntry
    );

    nextTasks = replaceTask(nextTasks, nextTask);
  }

  return {
    ...previousState,
    tasks: nextTasks,
    timeBlocks: nextBlocks,
    timerSessions:
      recordedDurationMinutes > 0 ? [session, ...previousState.timerSessions] : previousState.timerSessions,
    activeTimer: null,
  };
}

export function AppDataProvider({
  children,
  initialDataJson,
  initialProjects = MOCK_PROJECTS,
  initialTags = MOCK_TAGS,
  preferLocalStateOnBoot = false,
}: {
  children: ReactNode;
  initialDataJson?: string;
  initialProjects?: Project[];
  initialTags?: Tag[];
  preferLocalStateOnBoot?: boolean;
}) {
  const [state, setState] = useState<AppDataState>(() =>
    getInitialState(initialDataJson, preferLocalStateOnBoot)
  );
  const [projects, setProjects] = useState<Project[]>(() =>
    getInitialProjects(initialProjects, preferLocalStateOnBoot)
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeAppDataState(state)));
  }, [state]);

  useEffect(() => {
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(serializeProjects(projects)));
  }, [projects]);

  useEffect(() => {
    if (!state.activeTimer?.isRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setState((currentState) => {
        if (!currentState.activeTimer?.isRunning) {
          return currentState;
        }

        return {
          ...currentState,
          activeTimer: {
            ...currentState.activeTimer,
            elapsedSeconds: getElapsedSeconds(currentState.activeTimer),
          },
        };
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [state.activeTimer?.isRunning]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setState((currentState) => {
        const nextBlocks = autoCompletePastCalendarEvents(
          currentState.timeBlocks,
          currentState.activeTimer
        );

        if (nextBlocks === currentState.timeBlocks) {
          return currentState;
        }

        return {
          ...currentState,
          timeBlocks: nextBlocks,
        };
      });
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const upsertProject = useCallback((project: Project) => {
    setProjects((currentProjects) => replaceProject(currentProjects, project));

    setState((currentState) => {
      const affectedTaskIds = new Set(
        currentState.tasks
          .filter((task) => task.projectId === project.id)
          .map((task) => task.id)
      );
      const nextTasks = currentState.tasks.map((task) =>
        task.projectId === project.id
          ? {
              ...task,
              categoryId: project.categoryId,
              updatedAt: new Date(),
            }
          : task
      );
      const nextTimeBlocks = currentState.timeBlocks.map((block) => {
        if (!block.taskId || !affectedTaskIds.has(block.taskId)) {
          return block;
        }

        const linkedTask = nextTasks.find((task) => task.id === block.taskId);
        return syncBlockWithTask(block, linkedTask);
      });
      const activeTask = currentState.activeTimer?.taskId
        ? nextTasks.find((task) => task.id === currentState.activeTimer?.taskId)
        : undefined;

      return {
        ...currentState,
        tasks: nextTasks,
        timeBlocks: sortBlocks(nextTimeBlocks),
        activeTimer:
          currentState.activeTimer && activeTask
            ? {
                ...currentState.activeTimer,
                categoryId: activeTask.categoryId,
              }
            : currentState.activeTimer,
      };
    });
  }, []);

  const deleteProject = useCallback((projectId: ProjectId) => {
    setProjects((currentProjects) =>
      currentProjects.filter((project) => project.id !== projectId)
    );

    setState((currentState) => ({
      ...currentState,
      tasks: currentState.tasks.map((task) =>
        task.projectId === projectId
          ? {
              ...task,
              projectId: undefined,
              updatedAt: new Date(),
            }
          : task
      ),
    }));
  }, []);

  const upsertTask = useCallback(
    (task: Task) => {
      setState((currentState) => {
        const nextTask = syncTaskWithProject(task, projects);
        const nextTasks = replaceTask(currentState.tasks, nextTask);
        const nextTimeBlocks = currentState.timeBlocks.map((block) =>
          block.taskId === nextTask.id ? syncBlockWithTask(block, nextTask) : block
        );

        return {
          ...currentState,
          tasks: nextTasks,
          timeBlocks: sortBlocks(nextTimeBlocks),
          activeTimer:
            currentState.activeTimer?.taskId === nextTask.id
              ? {
                  ...currentState.activeTimer,
                  categoryId: nextTask.categoryId,
                }
              : currentState.activeTimer,
        };
      });
    },
    [projects]
  );

  const deleteTask = useCallback((taskId: TaskId) => {
    setState((currentState) => {
      const linkedBlocks = currentState.timeBlocks.filter((block) => block.taskId === taskId);
      const linkedBlockIds = new Set(linkedBlocks.map((block) => block.id));
      const nestedChildBlockIds = collectNestedChildBlockIds(currentState.timeBlocks, linkedBlockIds);
      const deletedBlockIds = new Set<TimeBlockId>([
        ...linkedBlockIds,
        ...nestedChildBlockIds,
      ]);
      const deletedBlocks = currentState.timeBlocks.filter((block) => deletedBlockIds.has(block.id));
      const nextBlocks = deletedBlocks.length
        ? currentState.timeBlocks.filter((block) => !deletedBlockIds.has(block.id))
        : currentState.timeBlocks;
      let nextTasks = currentState.tasks.filter((task) => task.id !== taskId);

      deletedBlocks.forEach((block) => {
        nextTasks = syncTasksForBlockChange(nextTasks, nextBlocks, block, undefined);
      });

      return {
        ...currentState,
        tasks: nextTasks,
        timeBlocks: nextBlocks,
        activeTimer:
          currentState.activeTimer?.taskId === taskId ||
          (currentState.activeTimer?.blockId
            ? deletedBlockIds.has(currentState.activeTimer.blockId)
            : false)
            ? null
            : currentState.activeTimer,
      };
    });
  }, []);

  const upsertTimeBlock = useCallback(
    (block: TimeBlock, options: UpsertTimeBlockOptions = {}) => {
      setState((currentState) => {
        const previousBlock = currentState.timeBlocks.find((item) => item.id === block.id);
        if (previousBlock && isProjectBoundaryBlock(previousBlock)) {
          return currentState;
        }

        if (isProjectBoundaryBlock(block)) {
          return currentState;
        }

        const linkedTask = block.taskId
          ? currentState.tasks.find((task) => task.id === block.taskId)
          : undefined;
        const nextStart = block.start;
        const nextEnd = block.end;
        const rangeMinutes = Math.max(calculateDurationMinutes(nextStart, nextEnd), 1);
        const nextBlock: TimeBlock = {
          ...syncBlockWithTask(block, linkedTask),
          plannedMinutes:
            options.preservePlannedMinutes &&
            previousBlock &&
            shouldPreservePlannedMinutes(previousBlock, block)
              ? previousBlock.plannedMinutes
              : rangeMinutes,
          actualMinutes:
            options.syncActualMinutesFromRange && previousBlock
              ? rangeMinutes
              : block.actualMinutes,
          notes: block.notes ?? previousBlock?.notes ?? [],
          source: normalizeTimeBlockSource({
            taskId: block.taskId,
            source: block.source ?? previousBlock?.source ?? 'manual',
          }),
        };
        const nextTimeBlocks = autoCompletePastCalendarEvents(
          syncNestedChildrenWithParentChange(
            replaceTimeBlock(currentState.timeBlocks, nextBlock),
            previousBlock,
            nextBlock
          ),
          currentState.activeTimer
        );

        return {
          ...currentState,
          timeBlocks: nextTimeBlocks,
          tasks:
            previousBlock && !previousBlock.parentBlockId
              ? syncTasksForNestedChildChanges(
                  syncTasksForBlockChange(currentState.tasks, nextTimeBlocks, previousBlock, nextBlock),
                  currentState.timeBlocks,
                  nextTimeBlocks,
                  nextBlock.id
                )
              : syncTasksForBlockChange(currentState.tasks, nextTimeBlocks, previousBlock, nextBlock),
        };
      });
    },
    []
  );

  const upsertTimeBlocks = useCallback(
    (blocks: TimeBlock[], options: UpsertTimeBlockOptions = {}) => {
      setState((currentState) => {
        let nextBlocks = currentState.timeBlocks;
        let nextTasks = currentState.tasks;

        blocks.forEach((block) => {
          const previousTimeBlocks = nextBlocks;
          const previousBlock = previousTimeBlocks.find((item) => item.id === block.id);
          if ((previousBlock && isProjectBoundaryBlock(previousBlock)) || isProjectBoundaryBlock(block)) {
            return;
          }

          const linkedTask = block.taskId
            ? nextTasks.find((task) => task.id === block.taskId)
            : undefined;
          const rangeMinutes = Math.max(calculateDurationMinutes(block.start, block.end), 1);
          const nextBlock: TimeBlock = {
            ...syncBlockWithTask(block, linkedTask),
            plannedMinutes:
              options.preservePlannedMinutes &&
              previousBlock &&
              shouldPreservePlannedMinutes(previousBlock, block)
                ? previousBlock.plannedMinutes
                : rangeMinutes,
            actualMinutes:
              options.syncActualMinutesFromRange && previousBlock
                ? rangeMinutes
                : block.actualMinutes,
            notes: block.notes ?? previousBlock?.notes ?? [],
            source: normalizeTimeBlockSource({
              taskId: block.taskId,
              source: block.source ?? previousBlock?.source ?? 'manual',
            }),
          };

          nextBlocks = syncNestedChildrenWithParentChange(
            replaceTimeBlock(previousTimeBlocks, nextBlock),
            previousBlock,
            nextBlock
          );
          nextTasks = syncTasksForBlockChange(nextTasks, nextBlocks, previousBlock, nextBlock);
          if (previousBlock && !previousBlock.parentBlockId) {
            nextTasks = syncTasksForNestedChildChanges(
              nextTasks,
              previousTimeBlocks,
              nextBlocks,
              nextBlock.id
            );
          }
        });

        return {
          ...currentState,
          timeBlocks: autoCompletePastCalendarEvents(nextBlocks, currentState.activeTimer),
          tasks: nextTasks,
        };
      });
    },
    []
  );

  const deleteTimeBlock = useCallback((blockId: TimeBlockId, options: DeleteTimeBlockOptions = {}) => {
    setState((currentState) => {
      const previousBlock = currentState.timeBlocks.find((block) => block.id === blockId);
      if (!previousBlock) {
        return currentState;
      }

      if (isProjectBoundaryBlock(previousBlock)) {
        return currentState;
      }

      const { remainingBlocks, deletedBlocks } = applyTimeBlockDeleteScope(
        currentState.timeBlocks,
        previousBlock,
        options.scope ?? 'single'
      );
      const primaryDeletedBlockIds = new Set(deletedBlocks.map((block) => block.id));
      const nestedChildBlockIds = collectNestedChildBlockIds(currentState.timeBlocks, primaryDeletedBlockIds);
      const deletedBlockIds = new Set<TimeBlockId>([
        ...primaryDeletedBlockIds,
        ...nestedChildBlockIds,
      ]);
      const allDeletedBlocks = currentState.timeBlocks.filter((block) => deletedBlockIds.has(block.id));
      const nextBlocks = deletedBlockIds.size > primaryDeletedBlockIds.size
        ? currentState.timeBlocks.filter((block) => !deletedBlockIds.has(block.id))
        : remainingBlocks;
      let nextTasks = currentState.tasks;

      allDeletedBlocks.forEach((block) => {
        nextTasks = syncTasksForBlockChange(nextTasks, nextBlocks, block, undefined);
      });

      return {
        ...currentState,
        timeBlocks: nextBlocks,
        tasks: nextTasks,
        activeTimer:
          currentState.activeTimer?.blockId && deletedBlockIds.has(currentState.activeTimer.blockId)
            ? null
            : currentState.activeTimer,
      };
    });
  }, []);

  const addTimeBlockNote = useCallback((blockId: TimeBlockId, input: AddTimeBlockNoteInput) => {
    const content = input.content.trim();
    if (!content) {
      return;
    }

    setState((currentState) => {
      const block = currentState.timeBlocks.find((item) => item.id === blockId);
      if (!block) {
        return currentState;
      }

      const now = new Date();
      const resolvedKind = input.kind ?? (block.taskId ? 'work-note' : 'recap');
      let resolvedNoteDuration = input.durationMinutes ?? getDefaultBlockNoteDuration(block);
      let linkedTaskProgressEntryId: TaskProgressEntryId | undefined;
      let linkedTimerSessionId: TimerSessionId | undefined;
      let nextTasks = currentState.tasks;

      if (block.taskId) {
        const task = currentState.tasks.find((item) => item.id === block.taskId);

        if (task) {
          const existingEntry = [...(task.progressEntries ?? [])].find(
            (entry) => entry.timeBlockId === block.id && entry.note.trim().length === 0
          );

          if (existingEntry) {
            const nextEntry: TaskProgressEntry = {
              ...existingEntry,
              note: content,
              updatedAt: now,
            };
            resolvedNoteDuration = existingEntry.durationMinutes;
            linkedTaskProgressEntryId = nextEntry.id;
            linkedTimerSessionId = nextEntry.timerSessionId;
            nextTasks = replaceTask(
              nextTasks,
              replaceTaskProgressEntry(task, existingEntry.id, nextEntry)
            );
          } else {
            const durationMinutes = resolvedNoteDuration;
            const nextEntry = createTaskProgressEntry({
              timeBlockId: block.id,
              durationMinutes,
              note: content,
              source: 'block-note',
              startedAt: block.start,
              endedAt: add(block.start, { minutes: durationMinutes }),
              createdAt: now,
              updatedAt: now,
            });
            linkedTaskProgressEntryId = nextEntry.id;
            linkedTimerSessionId = nextEntry.timerSessionId;
            nextTasks = replaceTask(nextTasks, appendTaskProgressEntry(task, nextEntry));
          }
        }
      }

      const note = createTimeBlockNote({
        content,
        durationMinutes: resolvedNoteDuration,
        kind: resolvedKind,
        taskProgressEntryId: linkedTaskProgressEntryId,
        timerSessionId: linkedTimerSessionId,
        createdAt: now,
        updatedAt: now,
      });
      const nextBlock: TimeBlock = {
        ...block,
        notes: [note, ...(block.notes ?? [])],
      };

      return {
        ...currentState,
        tasks: nextTasks,
        timeBlocks: replaceTimeBlock(currentState.timeBlocks, nextBlock),
      };
    });
  }, []);

  const scheduleTaskOnCalendar = useCallback((taskId: TaskId) => {
    setState((currentState) => {
      const task = currentState.tasks.find((item) => item.id === taskId);
      if (!task) {
        return currentState;
      }

      const existingBlock = task.calendarBlockId
        ? currentState.timeBlocks.find((block) => block.id === task.calendarBlockId)
        : currentState.timeBlocks.find((block) => block.taskId === task.id);
      const nextBlock: TimeBlock = existingBlock
        ? {
            ...existingBlock,
            title: task.title,
            description: task.description,
            categoryId: task.categoryId,
            tagIds: task.tagIds,
            taskId: task.id,
            source: existingBlock.source === 'google-calendar' ? existingBlock.source : 'task',
            status: existingBlock.status === 'completed' ? existingBlock.status : 'scheduled',
          }
        : buildTaskBlock(task);

      return {
        ...currentState,
        timeBlocks: replaceTimeBlock(currentState.timeBlocks, nextBlock),
        tasks: (() => {
          const syncedTasks = syncTasksForBlockChange(
            currentState.tasks,
            replaceTimeBlock(currentState.timeBlocks, nextBlock),
            existingBlock,
            nextBlock
          );
          const syncedTask = syncedTasks.find((item) => item.id === task.id) ?? task;

          return replaceTask(syncedTasks, {
            ...syncedTask,
            status: task.status === 'inbox' ? 'next' : task.status,
            updatedAt: new Date(),
          });
        })(),
      };
    });
  }, []);

  const startTimer = useCallback((taskId?: TaskId, blockId?: TimeBlockId) => {
    setState((currentState) => {
      let nextState = currentState.activeTimer
        ? finalizeActiveTimer(currentState, { completeTask: false })
        : currentState;
      const now = new Date();
      const roundedStart = getRoundedNow();

      const task = taskId ? nextState.tasks.find((item) => item.id === taskId) : undefined;
      let nextBlockId = blockId ?? task?.calendarBlockId;

      if (task && !nextBlockId) {
        const nextBlock = buildTaskBlock(task, {
          start: roundedStart,
          end: add(roundedStart, { minutes: task.estimatedMinutes ?? 60 }),
          status: 'in-progress',
          actualMinutes: 0,
        });

        nextState = {
          ...nextState,
          timeBlocks: replaceTimeBlock(nextState.timeBlocks, nextBlock),
          tasks: syncTasksForBlockChange(
            nextState.tasks,
            replaceTimeBlock(nextState.timeBlocks, nextBlock),
            undefined,
            nextBlock
          ),
        };
        nextBlockId = nextBlock.id;
      }

      if (nextBlockId) {
        const linkedBlock = nextState.timeBlocks.find((item) => item.id === nextBlockId);
        if (linkedBlock) {
          const inProgressBlock = {
            ...linkedBlock,
            status: 'in-progress' as const,
          };
          nextState = {
            ...nextState,
            timeBlocks: replaceTimeBlock(nextState.timeBlocks, inProgressBlock),
            tasks: syncTasksForBlockChange(
              nextState.tasks,
              replaceTimeBlock(nextState.timeBlocks, inProgressBlock),
              linkedBlock,
              inProgressBlock
            ),
          };
        }
      }

      if (task) {
        const syncedTask = nextState.tasks.find((item) => item.id === task.id) ?? task;
        nextState = {
          ...nextState,
          tasks: replaceTask(nextState.tasks, {
            ...syncedTask,
            status:
              syncedTask.status === 'inbox' || syncedTask.status === 'next'
                ? 'doing'
                : syncedTask.status,
            updatedAt: now,
          }),
        };
      }

      return {
        ...nextState,
        activeTimer: {
          id: createLocalId<TimerSessionId>('session'),
          taskId,
          blockId: nextBlockId,
          categoryId: task?.categoryId ?? DEFAULT_CATEGORIES[0].id,
          startedAt: now,
          elapsedSeconds: 0,
          isRunning: true,
          pomodoroMode: false,
        },
      };
    });
  }, []);

  const pauseTimer = useCallback(() => {
    setState((currentState) => {
      if (!currentState.activeTimer?.isRunning) {
        return currentState;
      }

      return {
        ...currentState,
        activeTimer: {
          ...currentState.activeTimer,
          elapsedSeconds: getElapsedSeconds(currentState.activeTimer),
          isRunning: false,
        },
      };
    });
  }, []);

  const resumeTimer = useCallback(() => {
    setState((currentState) => {
      if (!currentState.activeTimer || currentState.activeTimer.isRunning) {
        return currentState;
      }

      const adjustedStart = new Date(
        Date.now() - currentState.activeTimer.elapsedSeconds * 1000
      );

      return {
        ...currentState,
        activeTimer: {
          ...currentState.activeTimer,
          startedAt: adjustedStart,
          isRunning: true,
        },
      };
    });
  }, []);

  const stopTimer = useCallback((options: StopTimerOptions = {}) => {
    setState((currentState) => finalizeActiveTimer(currentState, options));
  }, []);

  const resetTimer = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      activeTimer: null,
    }));
  }, []);

  const completeTask = useCallback((taskId: TaskId, actualMinutes?: number) => {
    setState((currentState) => {
      if (currentState.activeTimer?.taskId === taskId) {
        return finalizeActiveTimer(currentState, { completeTask: true });
      }

      const task = currentState.tasks.find((item) => item.id === taskId);
      if (!task) {
        return currentState;
      }

      const linkedBlock = task.calendarBlockId
        ? currentState.timeBlocks.find((block) => block.id === task.calendarBlockId)
        : currentState.timeBlocks.find((block) => block.taskId === task.id);
      const blockDurationMinutes = linkedBlock
        ? Math.max(calculateDurationMinutes(linkedBlock.start, linkedBlock.end), 1)
        : undefined;
      const resolvedActualMinutes =
        actualMinutes ??
        linkedBlock?.actualMinutes ??
        blockDurationMinutes ??
        task.actualMinutes ??
        task.estimatedMinutes ??
        0;

      let nextTasks = currentState.tasks;
      let nextBlocks = currentState.timeBlocks;
      const completedAt = new Date();
      let resolvedCompletedMinutes = resolvedActualMinutes;

      if (linkedBlock) {
        const completedBlock = resolveCompletedTimeBlock(
          linkedBlock,
          resolvedActualMinutes,
          currentState.timeBlocks,
          'completed'
        );
        const completedActualMinutes = completedBlock.actualMinutes;

        nextBlocks = replaceTimeBlock(nextBlocks, completedBlock);
        nextTasks = syncTasksForBlockChange(nextTasks, nextBlocks, linkedBlock, completedBlock);
        resolvedCompletedMinutes = completedActualMinutes;
      }

      const syncedTask = nextTasks.find((item) => item.id === task.id) ?? task;
      const completedTask: Task = {
        ...syncedTask,
        actualMinutes: resolvedCompletedMinutes,
        status: 'done',
        updatedAt: completedAt,
      };

      nextTasks = replaceTask(
        nextTasks,
        resolvedCompletedMinutes > 0
          ? appendTaskProgressEntry(
              completedTask,
              createTaskProgressEntry({
                timeBlockId: linkedBlock?.id,
                durationMinutes: resolvedCompletedMinutes,
                note: '',
                source: 'manual',
                startedAt: linkedBlock?.start,
                endedAt:
                  linkedBlock?.start
                    ? add(linkedBlock.start, { minutes: Math.max(resolvedCompletedMinutes, 1) })
                    : completedAt,
                createdAt: completedAt,
                updatedAt: completedAt,
              })
            )
          : completedTask
      );

      return {
        ...currentState,
        tasks: nextTasks,
        timeBlocks: nextBlocks,
      };
    });
  }, []);

  const activeElapsedSeconds = getElapsedSeconds(state.activeTimer);
  const derivedTimeBlocks = useMemo(
    () =>
      autoCompletePastCalendarEvents(
        reconcileProjectBoundaryBlocks(state.timeBlocks, projects),
        state.activeTimer
      ),
    [projects, state.activeTimer, state.timeBlocks]
  );
  const activeTask = state.activeTimer?.taskId
    ? state.tasks.find((task) => task.id === state.activeTimer?.taskId)
    : undefined;
  const activeTimeBlock = state.activeTimer?.blockId
    ? derivedTimeBlocks.find((block) => block.id === state.activeTimer?.blockId)
    : undefined;

  const value = useMemo<AppDataContextValue>(
    () => ({
      tasks: state.tasks,
      timeBlocks: derivedTimeBlocks,
      timerSessions: state.timerSessions,
      projects,
      tags: initialTags,
      activeTimer: state.activeTimer,
      isTimerRunning: Boolean(state.activeTimer?.isRunning),
      activeTask,
      activeTimeBlock,
      activeElapsedSeconds,
      activeElapsedLabel: formatElapsedTime(activeElapsedSeconds),
      upsertProject,
      deleteProject,
      upsertTask,
      deleteTask,
      upsertTimeBlock,
      upsertTimeBlocks,
      deleteTimeBlock,
      addTimeBlockNote,
      scheduleTaskOnCalendar,
      startTimer,
      pauseTimer,
      resumeTimer,
      stopTimer,
      resetTimer,
      completeTask,
      formatElapsedTime,
    }),
    [
      activeElapsedSeconds,
      activeTask,
      activeTimeBlock,
      completeTask,
      deleteTask,
      addTimeBlockNote,
      deleteTimeBlock,
      pauseTimer,
      resetTimer,
      resumeTimer,
      scheduleTaskOnCalendar,
      startTimer,
      state.activeTimer,
      state.tasks,
      state.timerSessions,
      stopTimer,
      upsertProject,
      deleteProject,
      upsertTask,
      upsertTimeBlock,
      upsertTimeBlocks,
      projects,
      initialTags,
      derivedTimeBlocks,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider.');
  }

  return context;
}
