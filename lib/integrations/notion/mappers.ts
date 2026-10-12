import { Task, TimeBlock, TimerSession } from '../../domain/types';
import { NotionSessionPage, NotionTaskPage, NotionTimeBlockPage } from './types';

type NotionMapperOptions = {
  databaseId?: string;
};

export function mapTaskToNotionPage(
  task: Task,
  options: NotionMapperOptions = {}
): NotionTaskPage {
  const databaseId = options.databaseId ?? 'notion-db-tasks';

  return {
    id: `notion-task-${task.id}`,
    databaseId,
    url: buildNotionUrl(databaseId, `notion-task-${task.id}`),
    archived: task.status === 'done',
    properties: {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      categoryId: task.categoryId as string,
      tagIds: task.tagIds.map(String),
      projectId: task.projectId ? (task.projectId as string) : undefined,
      dueDate: task.dueDate?.toISOString(),
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: task.actualMinutes,
      scheduledStart: task.scheduledStart?.toISOString(),
      scheduledEnd: task.scheduledEnd?.toISOString(),
    },
  };
}

export function mapNotionPageToTask(page: NotionTaskPage): Task {
  return {
    id: page.id as Task['id'],
    title: page.properties.title,
    description: page.properties.description,
    status: page.properties.status as Task['status'],
    priority: page.properties.priority as Task['priority'],
    projectId: page.properties.projectId ? (page.properties.projectId as Task['projectId']) : undefined,
    categoryId: page.properties.categoryId as Task['categoryId'],
    tagIds: page.properties.tagIds.map((tagId) => tagId as Task['tagIds'][number]),
    dueDate: page.properties.dueDate ? new Date(page.properties.dueDate) : undefined,
    estimatedMinutes: page.properties.estimatedMinutes,
    scheduledStart: page.properties.scheduledStart
      ? new Date(page.properties.scheduledStart)
      : undefined,
    scheduledEnd: page.properties.scheduledEnd ? new Date(page.properties.scheduledEnd) : undefined,
    actualMinutes: page.properties.actualMinutes,
    progressEntries: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function mapTimeBlockToNotionPage(
  block: TimeBlock,
  options: NotionMapperOptions = {}
): NotionTimeBlockPage {
  const databaseId = options.databaseId ?? 'notion-db-schedule';

  return {
    id: `notion-block-${block.id}`,
    databaseId,
    url: buildNotionUrl(databaseId, `notion-block-${block.id}`),
    archived: block.status === 'cancelled',
    properties: {
      title: block.title,
      description: block.description,
      categoryId: block.categoryId as string,
      tagIds: block.tagIds.map(String),
      taskId: block.taskId ? (block.taskId as string) : undefined,
      start: block.start.toISOString(),
      end: block.end.toISOString(),
      plannedMinutes: block.plannedMinutes,
      actualMinutes: block.actualMinutes,
      source: block.source,
      status: block.status,
    },
  };
}

export function mapTimerSessionToNotionPage(
  session: TimerSession,
  options: NotionMapperOptions = {}
): NotionSessionPage {
  const databaseId = options.databaseId ?? 'notion-db-sessions';

  return {
    id: `notion-session-${session.id}`,
    databaseId,
    url: buildNotionUrl(databaseId, `notion-session-${session.id}`),
    archived: false,
    properties: {
      title: session.pomodoroMode ? 'Pomodoro session' : 'Timer session',
      taskId: session.taskId ? (session.taskId as string) : undefined,
      categoryId: session.categoryId as string,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime?.toISOString(),
      durationMinutes: session.durationMinutes,
      pomodoroMode: session.pomodoroMode,
      source: session.source,
    },
  };
}

function buildNotionUrl(databaseId: string, pageId: string) {
  return `https://www.notion.so/${databaseId}/${pageId}`;
}
