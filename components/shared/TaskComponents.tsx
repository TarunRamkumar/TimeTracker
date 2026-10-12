'use client';

import { format, isToday, isTomorrow } from 'date-fns';
import { CalendarClock, CheckCircle2, Clock, Flag, Play, Timer } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { Category, Tag, Task } from '@/lib/domain/types';
import { formatMinutes, getPriorityColor, getTaskStatusColor } from '@/lib/domain/helpers';

export function TaskCard({
  task,
  category,
  projectName,
  tags = [],
  onClick,
  onStartTimer,
  onStopTimer,
  onSchedule,
  onMarkDone,
  isTimerActive = false,
  isTimerRunning = false,
}: {
  task: Task;
  category?: Category;
  projectName?: string;
  tags?: Tag[];
  onClick?: () => void;
  onStartTimer?: () => void;
  onStopTimer?: () => void;
  onSchedule?: () => void;
  onMarkDone?: () => void;
  isTimerActive?: boolean;
  isTimerRunning?: boolean;
}) {
  const estimateMinutes = task.estimatedMinutes ?? 0;
  const deltaMinutes = task.actualMinutes - estimateMinutes;
  const scheduleLabel =
    task.scheduledStart && task.scheduledEnd
      ? `${format(task.scheduledStart, 'EEE h:mm a')} - ${format(task.scheduledEnd, 'h:mm a')}`
      : 'Not on calendar yet';

  return (
    <div
      onClick={onClick}
      className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition-all ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getTaskStatusColor(
                task.status
              )}`}
            >
              {task.status}
            </span>
            {projectName ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {projectName}
              </span>
            ) : null}
            {task.calendarBlockId ? (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                On calendar
              </span>
            ) : null}
            {isTimerActive ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {isTimerRunning ? 'Working now' : 'Timer paused'}
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 text-base font-semibold leading-tight text-slate-950">{task.title}</h3>

          {task.description ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
          ) : null}
        </div>

        {category ? (
          <div className="flex flex-col items-end gap-2">
            <div
              className="h-10 w-2 rounded-full"
              style={{ backgroundColor: category.color }}
              title={category.name}
            />
            <span className="text-xs font-medium text-slate-500">{category.name}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <TaskMetric label="Estimate" value={estimateMinutes > 0 ? formatMinutes(estimateMinutes) : 'None'} />
        <TaskMetric label="Actual" value={formatMinutes(task.actualMinutes)} />
      </div>

      <div className="mt-3 rounded-2xl bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Estimate vs actual
          </p>
          <p
            className={`text-xs font-medium ${
              deltaMinutes > 0
                ? 'text-amber-700'
                : deltaMinutes < 0
                  ? 'text-emerald-700'
                  : 'text-slate-600'
            }`}
          >
            {deltaMinutes === 0 ? 'On plan' : formatSignedMinutes(deltaMinutes)}
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full ${
              estimateMinutes > 0 && task.actualMinutes > estimateMinutes
                ? 'bg-amber-500'
                : 'bg-blue-600'
            }`}
            style={{
              width: `${estimateMinutes > 0 ? Math.min((task.actualMinutes / estimateMinutes) * 100, 100) : 0}%`,
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
          <Clock className="h-3.5 w-3.5" />
          {task.dueDate ? formatDueDate(task.dueDate) : 'No due date'}
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          {scheduleLabel}
        </div>
        {task.priority !== 'low' ? (
          <div className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 ${getPriorityColor(task.priority)}`}>
            <Flag className="h-3.5 w-3.5" />
            {task.priority} priority
          </div>
        ) : null}
      </div>

      {tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="default"
              className="border border-slate-200 bg-white text-slate-600"
            >
              <span
                className="mr-2 h-2 w-2 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {isTimerActive && onStopTimer ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              onStopTimer();
            }}
            className="inline-flex items-center gap-2 rounded-full"
          >
            <Timer className="h-4 w-4" />
            {isTimerRunning ? 'Stop timer' : 'Resume timer'}
          </Button>
        ) : onStartTimer ? (
          <Button
            size="sm"
            variant="primary"
            onClick={(event) => {
              event.stopPropagation();
              onStartTimer();
            }}
            className="inline-flex items-center gap-2 rounded-full"
          >
            <Play className="h-4 w-4" />
            Start timer
          </Button>
        ) : null}

        {onSchedule ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              onSchedule();
            }}
            className="rounded-full border border-slate-200 bg-white"
          >
            {task.scheduledStart ? 'Reschedule' : 'Schedule'}
          </Button>
        ) : null}

        {onMarkDone ? (
          <Button
            size="sm"
            variant={task.status === 'done' ? 'secondary' : 'ghost'}
            onClick={(event) => {
              event.stopPropagation();
              onMarkDone();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white"
            disabled={task.status === 'done'}
          >
            <CheckCircle2 className="h-4 w-4" />
            {task.status === 'done' ? 'Completed' : 'Mark done'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function TaskItem({
  task,
  category,
  onStartTimer,
  onSchedule,
}: {
  task: Task;
  category?: Category;
  onStartTimer?: () => void;
  onSchedule?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/40 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <div
          className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: category?.color }}
        />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-slate-900">{task.title}</h4>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{category?.name}</span>
            {task.estimatedMinutes ? <span>{formatMinutes(task.estimatedMinutes)}</span> : null}
            {task.dueDate ? <span>{formatDueDate(task.dueDate)}</span> : null}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {onStartTimer ? (
            <button
              onClick={onStartTimer}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Timer
            </button>
          ) : null}
          {onSchedule ? (
            <button
              onClick={onSchedule}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Schedule
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TaskMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function formatDueDate(date: Date) {
  if (isToday(date)) {
    return 'Due today';
  }

  if (isTomorrow(date)) {
    return 'Due tomorrow';
  }

  return `Due ${format(date, 'MMM d')}`;
}

function formatSignedMinutes(minutes: number) {
  if (minutes === 0) {
    return 'On plan';
  }

  const sign = minutes > 0 ? '+' : '-';
  return `${sign}${formatMinutes(Math.abs(minutes))}`;
}
