import { add, endOfDay, startOfDay } from 'date-fns';
import { Task, TimeBlock, TimerSession } from '../../domain/types';
import { GoogleCalendarEvent } from './types';

const DEFAULT_GOOGLE_TIMEZONE = 'America/New_York';

const GOOGLE_COLOR_IDS: Record<string, string> = {
  'cat-work': '9',
  'cat-sports': '10',
  'cat-internship': '3',
  'cat-study': '5',
  'cat-personal': '6',
  'cat-social': '11',
};

type GoogleMapperOptions = {
  timezone?: string;
  calendarId?: string;
  fallbackStart?: Date;
};

const GOOGLE_WEEKDAY_MAP: Record<NonNullable<TimeBlock['recurrence']>['daysOfWeek'][number], string> = {
  0: 'SU',
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
};

const GOOGLE_WEEKDAY_REVERSE_MAP: Record<string, NonNullable<TimeBlock['recurrence']>['daysOfWeek'][number]> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

export function mapTimeBlockToGoogleCalendarEvent(
  block: TimeBlock,
  options: GoogleMapperOptions = {}
): GoogleCalendarEvent {
  const timezone = options.timezone ?? DEFAULT_GOOGLE_TIMEZONE;
  const calendarId = options.calendarId ?? block.calendarId ?? 'primary';

  return {
    id: block.googleEventId ?? `google-event-${block.id}`,
    calendarId,
    summary: block.title,
    description: block.description,
    start: {
      dateTime: block.start.toISOString(),
      timeZone: timezone,
    },
    end: {
      dateTime: block.end.toISOString(),
      timeZone: timezone,
    },
    colorId: GOOGLE_COLOR_IDS[block.categoryId as string],
    status: mapTimeBlockStatus(block.status),
    recurrence: block.recurrence ? mapRecurrenceToGoogleRules(block) : undefined,
    extendedProperties: {
      private: {
        localTimeBlockId: block.id as string,
        taskId: block.taskId ? (block.taskId as string) : '',
        categoryId: block.categoryId as string,
        tagIds: block.tagIds.map(String).join(','),
        plannedMinutes: String(block.plannedMinutes),
        actualMinutes: String(block.actualMinutes),
        source: block.source,
        recurrenceSeriesId: block.recurrence?.seriesId ?? '',
        recurrenceIndex: String(block.recurrenceIndex ?? ''),
      },
    },
  };
}

export function mapGoogleCalendarEventToTimeBlock(event: GoogleCalendarEvent): TimeBlock {
  const properties = event.extendedProperties.private;
  const start = new Date(event.start.dateTime);
  const end = new Date(event.end.dateTime);
  const plannedMinutes = Number(properties.plannedMinutes ?? calculateMinutes(start, end));
  const actualMinutes = Number(properties.actualMinutes ?? 0);
  const recurrence = mapGoogleRulesToRecurrence(event.recurrence, properties.recurrenceSeriesId || undefined);
  const recurrenceIndex = properties.recurrenceIndex ? Number(properties.recurrenceIndex) : undefined;

  return {
    id: (properties.localTimeBlockId || event.id) as TimeBlock['id'],
    title: event.summary,
    description: event.description,
    categoryId: (properties.categoryId || 'cat-work') as TimeBlock['categoryId'],
    tagIds: (properties.tagIds ? properties.tagIds.split(',').filter(Boolean) : []).map(
      (tagId) => tagId as TimeBlock['tagIds'][number]
    ),
    taskId: properties.taskId ? (properties.taskId as TimeBlock['taskId']) : undefined,
    start,
    end,
    plannedMinutes,
    actualMinutes,
    source: 'google-calendar',
    status: mapGoogleStatus(event.status),
    recurrence,
    recurrenceIndex: Number.isNaN(recurrenceIndex) ? undefined : recurrenceIndex,
    googleEventId: event.id,
    calendarId: event.calendarId,
    notes: [],
  };
}

export function mapTaskToGoogleCalendarEvent(
  task: Task,
  options: GoogleMapperOptions = {}
): GoogleCalendarEvent {
  const timezone = options.timezone ?? DEFAULT_GOOGLE_TIMEZONE;
  const start = task.scheduledStart ?? task.dueDate ?? options.fallbackStart ?? new Date();
  const end = task.scheduledEnd ?? add(start, { minutes: task.estimatedMinutes ?? 60 });

  return {
    id: `google-task-${task.id}`,
    calendarId: options.calendarId ?? 'primary',
    summary: `Task: ${task.title}`,
    description: task.description,
    start: {
      dateTime: start.toISOString(),
      timeZone: timezone,
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: timezone,
    },
    colorId: GOOGLE_COLOR_IDS[task.categoryId as string],
    status: task.status === 'done' ? 'confirmed' : 'tentative',
    extendedProperties: {
      private: {
        localTaskId: task.id as string,
        categoryId: task.categoryId as string,
        projectId: task.projectId ? (task.projectId as string) : '',
        estimatedMinutes: String(task.estimatedMinutes ?? 0),
        actualMinutes: String(task.actualMinutes),
        status: task.status,
        priority: task.priority,
      },
    },
  };
}

export function mapTimerSessionToGoogleCalendarEvent(
  session: TimerSession,
  options: GoogleMapperOptions = {}
): GoogleCalendarEvent {
  const timezone = options.timezone ?? DEFAULT_GOOGLE_TIMEZONE;
  const end = session.endTime ?? add(session.startTime, { minutes: session.durationMinutes || 25 });

  return {
    id: `google-session-${session.id}`,
    calendarId: options.calendarId ?? 'primary',
    summary: session.pomodoroMode ? 'Pomodoro focus session' : 'Tracked focus session',
    description: `Tracked ${session.durationMinutes} minutes inside TimeTracker.`,
    start: {
      dateTime: session.startTime.toISOString(),
      timeZone: timezone,
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: timezone,
    },
    status: session.endTime ? 'confirmed' : 'tentative',
    extendedProperties: {
      private: {
        localSessionId: session.id as string,
        taskId: session.taskId ? (session.taskId as string) : '',
        categoryId: session.categoryId as string,
        durationMinutes: String(session.durationMinutes),
        pomodoroMode: String(session.pomodoroMode),
        source: session.source,
      },
    },
  };
}

function mapTimeBlockStatus(status: TimeBlock['status']): GoogleCalendarEvent['status'] {
  if (status === 'cancelled') {
    return 'cancelled';
  }

  return status === 'scheduled' ? 'tentative' : 'confirmed';
}

function mapGoogleStatus(status: GoogleCalendarEvent['status']): TimeBlock['status'] {
  if (status === 'cancelled') {
    return 'cancelled';
  }

  return status === 'tentative' ? 'scheduled' : 'completed';
}

function calculateMinutes(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

function mapRecurrenceToGoogleRules(block: TimeBlock) {
  const recurrence = block.recurrence;
  if (!recurrence) {
    return [];
  }

  const parts = [
    'RRULE:FREQ=WEEKLY',
    `BYDAY=${recurrence.daysOfWeek.map((day) => GOOGLE_WEEKDAY_MAP[day]).join(',')}`,
  ];

  if (recurrence.endType === 'onDate' && recurrence.until) {
    parts.push(`UNTIL=${toGoogleRRuleDate(endOfDay(recurrence.until))}`);
  }

  if (recurrence.endType === 'afterOccurrences' && recurrence.count) {
    parts.push(`COUNT=${recurrence.count}`);
  }

  const rules = [parts.join(';')];
  const exclusionDates = recurrence.exclusionDates ?? [];

  if (exclusionDates.length > 0) {
    rules.push(
      `EXDATE:${exclusionDates
        .map((date) => toGoogleRRuleDate(withBlockStartTime(date, block.start)))
        .join(',')}`
    );
  }

  return rules;
}

function mapGoogleRulesToRecurrence(
  rules: string[] | undefined,
  seriesId: string | undefined
): TimeBlock['recurrence'] | undefined {
  const rule = rules?.find((value) => value.startsWith('RRULE:'));
  if (!rule?.startsWith('RRULE:')) {
    return undefined;
  }

  const segments = rule.replace('RRULE:', '').split(';');
  const parsed = new Map(
    segments.map((segment) => {
      const [key, value] = segment.split('=');
      return [key, value];
    })
  );

  if (parsed.get('FREQ') !== 'WEEKLY') {
    return undefined;
  }

  const days = (parsed.get('BYDAY') ?? '')
    .split(',')
    .map((value) => GOOGLE_WEEKDAY_REVERSE_MAP[value])
    .filter((value): value is NonNullable<TimeBlock['recurrence']>['daysOfWeek'][number] =>
      typeof value === 'number'
  );

  const untilValue = parsed.get('UNTIL');
  const countValue = parsed.get('COUNT');
  const exclusionDates = (rules ?? [])
    .filter((value) => value.startsWith('EXDATE:'))
    .flatMap((value) => value.replace('EXDATE:', '').split(','))
    .filter(Boolean)
    .map((value) => startOfDay(parseGoogleRRuleDate(value)));

  return {
    frequency: 'weekly',
    daysOfWeek: days,
    endType: untilValue ? 'onDate' : 'afterOccurrences',
    until: untilValue ? parseGoogleRRuleDate(untilValue) : undefined,
    count: countValue ? Number(countValue) : undefined,
    exclusionDates: exclusionDates.length > 0 ? exclusionDates : undefined,
    seriesId: seriesId ?? 'google-series',
  };
}

function withBlockStartTime(date: Date, blockStart: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(
    blockStart.getHours(),
    blockStart.getMinutes(),
    blockStart.getSeconds(),
    blockStart.getMilliseconds()
  );

  return nextDate;
}

function toGoogleRRuleDate(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function parseGoogleRRuleDate(value: string) {
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/
  );

  if (!match) {
    return new Date(value);
  }

  const [, year, month, day, hours, minutes, seconds] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds)
    )
  );
}
