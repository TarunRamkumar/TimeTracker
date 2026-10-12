import { add } from 'date-fns';
import { Task, TimeBlock, TimerSession } from '../../domain/types';
import { ClockifyTaskRecord, ClockifyTimeEntry } from './types';

type ClockifyMapperOptions = {
  workspaceId?: string;
};

export function mapTimerSessionToClockifyTimeEntry(
  session: TimerSession,
  options: ClockifyMapperOptions = {}
): ClockifyTimeEntry {
  const workspaceId = options.workspaceId ?? 'clockify-workspace-primary';
  const end = session.endTime ?? add(session.startTime, { minutes: session.durationMinutes || 25 });

  return {
    id: `clockify-session-${session.id}`,
    workspaceId,
    description: session.pomodoroMode ? 'Pomodoro focus session' : 'Tracked session',
    start: session.startTime.toISOString(),
    end: end.toISOString(),
    durationMinutes: session.durationMinutes,
    projectId: undefined,
    taskId: session.taskId ? (session.taskId as string) : undefined,
    tagIds: [],
    billable: false,
    customFields: {
      categoryId: session.categoryId as string,
      pomodoroMode: String(session.pomodoroMode),
      source: session.source,
    },
  };
}

export function mapClockifyTimeEntryToTimerSession(entry: ClockifyTimeEntry): TimerSession {
  return {
    id: entry.id as TimerSession['id'],
    taskId: entry.taskId ? (entry.taskId as TimerSession['taskId']) : undefined,
    categoryId: (entry.customFields.categoryId || 'cat-work') as TimerSession['categoryId'],
    startTime: new Date(entry.start),
    endTime: entry.end ? new Date(entry.end) : undefined,
    durationMinutes: entry.durationMinutes,
    pomodoroMode: entry.customFields.pomodoroMode === 'true',
    source: entry.customFields.source === 'extension' ? 'extension' : 'web',
  };
}

export function mapTimeBlockToClockifyTimeEntry(
  block: TimeBlock,
  options: ClockifyMapperOptions = {}
): ClockifyTimeEntry {
  const workspaceId = options.workspaceId ?? 'clockify-workspace-primary';

  return {
    id: `clockify-block-${block.id}`,
    workspaceId,
    description: block.title,
    start: block.start.toISOString(),
    end: block.end.toISOString(),
    durationMinutes: block.plannedMinutes,
    projectId: undefined,
    taskId: block.taskId ? (block.taskId as string) : undefined,
    tagIds: block.tagIds.map(String),
    billable: false,
    customFields: {
      categoryId: block.categoryId as string,
      source: block.source,
      status: block.status,
      actualMinutes: String(block.actualMinutes),
    },
  };
}

export function mapTaskToClockifyTask(
  task: Task,
  options: ClockifyMapperOptions = {}
): ClockifyTaskRecord {
  const workspaceId = options.workspaceId ?? 'clockify-workspace-primary';

  return {
    id: `clockify-task-${task.id}`,
    workspaceId,
    name: task.title,
    projectId: task.projectId ? (task.projectId as string) : undefined,
    status: task.status === 'done' ? 'DONE' : 'ACTIVE',
    estimateMinutes: task.estimatedMinutes,
    actualMinutes: task.actualMinutes,
    note: task.description,
  };
}
