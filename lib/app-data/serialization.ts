import type {
  CategoryId,
  Project,
  Task,
  TaskId,
  TaskProgressEntry,
  TimeBlock,
  TimeBlockId,
  TimeBlockNote,
  TimerSession,
  TimerSessionId,
} from '@/lib/domain/types';

export type ActiveTimerState = {
  id: TimerSessionId;
  taskId?: TaskId;
  blockId?: TimeBlockId;
  categoryId: CategoryId;
  startedAt: Date;
  elapsedSeconds: number;
  isRunning: boolean;
  pomodoroMode: boolean;
};

export type PersistedAppData = {
  tasks: Array<
    Omit<Task, 'dueDate' | 'scheduledStart' | 'scheduledEnd' | 'createdAt' | 'updatedAt' | 'progressEntries'> & {
      dueDate?: string;
      scheduledStart?: string;
      scheduledEnd?: string;
      progressEntries: Array<
        Omit<TaskProgressEntry, 'startedAt' | 'endedAt' | 'createdAt' | 'updatedAt'> & {
          startedAt?: string;
          endedAt?: string;
          createdAt: string;
          updatedAt: string;
        }
      >;
      createdAt: string;
      updatedAt: string;
    }
  >;
  timeBlocks: Array<
    Omit<TimeBlock, 'start' | 'end' | 'recurrence' | 'notes'> & {
      start: string;
      end: string;
      notes: Array<
        Omit<TimeBlockNote, 'createdAt' | 'updatedAt'> & {
          createdAt: string;
          updatedAt: string;
        }
      >;
      recurrence?: Omit<NonNullable<TimeBlock['recurrence']>, 'until' | 'exclusionDates'> & {
        until?: string;
        exclusionDates?: string[];
      };
    }
  >;
  timerSessions: Array<
    Omit<TimerSession, 'startTime' | 'endTime'> & { startTime: string; endTime?: string }
  >;
  activeTimer: Omit<ActiveTimerState, 'startedAt'> & { startedAt: string } | null;
};

export type PersistedProject = Omit<Project, 'startDate' | 'endDate'> & {
  startDate?: string;
  endDate?: string;
};

export type AppDataState = {
  tasks: Task[];
  timeBlocks: TimeBlock[];
  timerSessions: TimerSession[];
  activeTimer: ActiveTimerState | null;
};

function toOptionalDate(value?: string | Date | null) {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function serializeProjects(projects: Project[]): PersistedProject[] {
  return projects.map((project) => ({
    ...project,
    startDate: project.startDate?.toISOString(),
    endDate: project.endDate?.toISOString(),
  }));
}

export function hydrateProjects(
  projects: Array<PersistedProject | Project> | null | undefined
): Project[] {
  if (!projects) {
    return [];
  }

  return projects.map((project) => ({
    ...project,
    startDate: toOptionalDate(project.startDate),
    endDate: toOptionalDate(project.endDate),
  }));
}

export function serializeAppDataState(state: AppDataState): PersistedAppData {
  return {
    tasks: state.tasks.map((task) => ({
      ...task,
      dueDate: task.dueDate?.toISOString(),
      scheduledStart: task.scheduledStart?.toISOString(),
      scheduledEnd: task.scheduledEnd?.toISOString(),
      progressEntries: (task.progressEntries ?? []).map((entry) => ({
        ...entry,
        startedAt: entry.startedAt?.toISOString(),
        endedAt: entry.endedAt?.toISOString(),
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    timeBlocks: state.timeBlocks.map((block) => ({
      ...block,
      start: block.start.toISOString(),
      end: block.end.toISOString(),
      notes: (block.notes ?? []).map((note) => ({
        ...note,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      })),
      recurrence: block.recurrence
        ? {
            ...block.recurrence,
            until: block.recurrence.until?.toISOString(),
            exclusionDates: block.recurrence.exclusionDates?.map((date) => date.toISOString()),
          }
        : undefined,
    })),
    timerSessions: state.timerSessions.map((session) => ({
      ...session,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime?.toISOString(),
    })),
    activeTimer: state.activeTimer
      ? {
          ...state.activeTimer,
          startedAt: state.activeTimer.startedAt.toISOString(),
        }
      : null,
  };
}
