'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Clock3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import {
  formatMinutes,
  getDayProgress,
  getWeekProgress,
  type TimeProgressSnapshot,
} from '@/lib/domain/helpers';

type ProgressScope = 'week' | 'day';

interface WeekProgressCardProps {
  referenceDate?: Date;
  title?: string;
  description?: string;
  className?: string;
  defaultScope?: ProgressScope;
}

export function WeekProgressCard({
  referenceDate,
  title = 'Time progress',
  description = 'A live read on how much of the current day or week has already elapsed.',
  className = '',
  defaultScope = 'week',
}: WeekProgressCardProps) {
  const [now, setNow] = useState(new Date());
  const [scope, setScope] = useState<ProgressScope>(defaultScope);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const targetDate = referenceDate ?? now;
  const progress =
    scope === 'week' ? getWeekProgress(targetDate, now) : getDayProgress(targetDate, now);
  const completionDegrees = (progress.percentComplete / 100) * 360;

  return (
    <Card className={`overflow-hidden rounded-[24px] border-slate-200 shadow-sm shadow-slate-200/60 ${className}`}>
      <CardHeader className="border-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold text-slate-950">{title}</CardTitle>
            <p className="text-sm leading-6 text-slate-600">{description}</p>
          </div>

          <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1">
            {(['week', 'day'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setScope(option)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  scope === option
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {option === 'week' ? 'Week' : 'Day'}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-center">
          <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-slate-100">
            <div
              className="flex h-32 w-32 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#2563eb 0deg ${completionDegrees}deg, #dbeafe ${completionDegrees}deg 360deg)`,
              }}
            >
              <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner shadow-slate-200/60">
                <p className="text-2xl font-semibold tracking-tight text-slate-950">
                  {progress.percentComplete.toFixed(1)}%
                </p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
                  complete
                </p>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {scope === 'week' ? 'Live week clock' : 'Live day clock'}
            </div>

            <div className="grid gap-2">
              <ProgressStat
                label="Elapsed"
                value={formatProgressHours(progress.elapsedMinutes)}
                title={formatMinutes(progress.elapsedMinutes)}
              />
              <ProgressStat
                label="Left"
                value={formatProgressHours(progress.remainingMinutes)}
                title={formatMinutes(progress.remainingMinutes)}
              />
              <ProgressStat
                label="Total"
                value={formatProgressHours(progress.totalMinutes)}
                title={formatMinutes(progress.totalMinutes)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <div className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-slate-500" />
            {getProgressRangeLabel(progress)}
          </div>
          <span className="font-medium text-slate-900">{progress.percentComplete.toFixed(1)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

function getProgressRangeLabel(progress: TimeProgressSnapshot) {
  if (progress.scope === 'day') {
    return format(progress.start, 'EEEE, MMM d');
  }

  return `${format(progress.start, 'EEE, MMM d')} to ${format(progress.end, 'EEE, MMM d')}`;
}

function ProgressStat({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div
      className="min-w-0 rounded-2xl border border-slate-200 bg-white px-2.5 py-3 shadow-sm shadow-slate-200/50"
      title={title}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p
        className="mt-2 truncate font-semibold leading-none tracking-tight tabular-nums text-slate-950"
        style={{ fontSize: getProgressValueFontSize(value) }}
      >
        {value}
      </p>
    </div>
  );
}

function formatProgressHours(minutes: number) {
  const roundedHours = Math.round((minutes / 60) * 10) / 10;
  return Number.isInteger(roundedHours) ? `${roundedHours.toFixed(0)}h` : `${roundedHours.toFixed(1)}h`;
}

function getProgressValueFontSize(value: string) {
  if (value.length >= 8) {
    return '0.68rem';
  }

  if (value.length >= 6) {
    return '0.76rem';
  }

  if (value.length >= 5) {
    return '0.84rem';
  }

  return '0.95rem';
}
