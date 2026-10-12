'use client';

import {
  AlertCircle,
  CalendarRange,
  Clock3,
  Layers3,
  Tags,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useAppData } from '@/components/providers/AppDataProvider';
import { useCategories } from '@/components/providers/CategoriesProvider';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, Card, CardContent, CardHeader, CardTitle, StatCard } from '@/components/ui';
import { PageShell } from '@/components/layout/PageShell';
import { formatCurrencyBreakdown, formatMinutes } from '@/lib/domain/helpers';
import { getWeeklyReviewData } from '@/lib/mock/dashboard';

export function WeeklyReviewPage() {
  const { categories } = useCategories();
  const { tasks, timeBlocks, timerSessions, projects, tags } = useAppData();
  const review = getWeeklyReviewData({
    categories,
    projects,
    tags,
    tasks,
    timeBlocks,
    timerSessions,
  });

  const paceData = review.dayBreakdown.map((day) => ({
    day: day.shortDay,
    scheduledHours: toHours(day.cumulativePlannedMinutes),
    actualHours: toHours(day.cumulativeActualMinutes),
  }));

  const dayOfWeekData = review.dayBreakdown.map((day) => ({
    day: day.shortDay,
    scheduledHours: toHours(day.plannedMinutes),
    actualHours: toHours(day.actualMinutes),
  }));

  const topCategory = review.categoryBreakdown[0];
  const topTag = review.tagBreakdown[0];

  return (
    <PageShell>
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f6f9ff_48%,#f8fafc_100%)] shadow-sm shadow-slate-200/60">
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <CalendarRange className="h-3.5 w-3.5" />
              Weekly review
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Analytics
              </h1>
              <p className="max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                A clean readout of what made it onto the calendar, where the hours actually went, and
                what still needs a calendar decision.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="info" className="bg-white text-slate-700">
                {review.weekLabel}
              </Badge>
              <Badge variant="success" className="bg-white text-slate-700">
                Top category: {review.summary.topCategoryName}
              </Badge>
              <Badge variant="default" className="bg-white text-slate-700">
                Top tag: {review.summary.topTagName}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile
              label="Weekly delta"
              value={formatSignedMinutes(review.summary.varianceMinutes)}
              detail={
                review.summary.varianceMinutes > 0
                  ? 'Tracked more than scheduled'
                  : review.summary.varianceMinutes < 0
                    ? 'Finished under the calendar'
                    : 'Matched the calendar'
              }
              tone={
                review.summary.varianceMinutes > 0
                  ? 'amber'
                  : review.summary.varianceMinutes < 0
                    ? 'green'
                    : 'slate'
              }
            />
            <MetricTile
              label="Most focused day"
              value={review.summary.mostFocusedDay.day}
              detail={formatMinutes(review.summary.mostFocusedDay.actualMinutes)}
              tone="blue"
            />
            <MetricTile
              label="Tasks with slots"
              value={`${review.summary.scheduledTasksThisWeek}`}
              detail={`${review.summary.unscheduledTasks} still unscheduled`}
              tone="slate"
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <StatCard
          title="Scheduled Time"
          value={formatMinutes(review.summary.plannedMinutes)}
          subtitle="Calendar commitments this week"
          color="blue"
        />
        <StatCard
          title="Tracked Time"
          value={formatMinutes(review.summary.actualMinutes)}
          subtitle="Actual time recorded so far"
          color="green"
        />
        <StatCard
          title="Execution Rate"
          value={`${review.summary.executionRate}%`}
          subtitle="Actual time against plan"
          color="purple"
        />
        <StatCard
          title="Completed Tasks"
          value={review.summary.completedTasksThisWeek}
          subtitle={`${review.summary.topProjectName} led project work`}
          color="amber"
        />
        <StatCard
          title="Week earnings"
          value={
            review.summary.earningsByCurrency.length > 0
              ? formatCurrencyBreakdown(review.summary.earningsByCurrency)
              : 'No paid time'
          }
          subtitle="Derived from paid calendar blocks"
          color="green"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_380px]">
        <div className="space-y-6">
          <Card className="overflow-hidden rounded-[28px] border-slate-200 shadow-sm shadow-slate-200/60">
            <CardHeader className="border-slate-200">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-semibold text-slate-950">
                    Scheduled vs actual pace
                  </CardTitle>
                  <p className="text-sm text-slate-600">
                    Cumulative hours across the week make the gap between intention and execution
                    easy to spot.
                  </p>
                </div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                    review.summary.varianceMinutes > 0
                      ? 'bg-amber-100 text-amber-800'
                      : review.summary.varianceMinutes < 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {review.summary.varianceMinutes > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {formatSignedMinutes(review.summary.varianceMinutes)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-6">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={paceData}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(value: number) => `${value}h`}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => formatTooltipHours(value)}
                    contentStyle={{
                      borderRadius: 16,
                      borderColor: '#e2e8f0',
                      boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="scheduledHours"
                    name="Scheduled"
                    stroke="#94a3b8"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 0, fill: '#94a3b8' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actualHours"
                    name="Actual"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 0, fill: '#2563eb' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[28px] border-slate-200 shadow-sm shadow-slate-200/60">
            <CardHeader className="border-slate-200">
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold text-slate-950">
                  Hours by category
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Category totals show where the week was actually spent, not just where it was
                  intended to go.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {review.categoryBreakdown.map((category) => (
                <div
                  key={category.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: category.fill }}
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-950">{category.name}</p>
                        <p className="text-xs text-slate-500">{category.blockCount} blocks</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-950">
                        {category.actualHours.toFixed(1)}h
                      </p>
                      <p className="text-xs text-slate-500">
                        {category.plannedHours.toFixed(1)}h on calendar
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: category.fill,
                        width: `${Math.min(category.executionRate, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {category.executionRate}% execution against the calendar
                  </p>
                  {category.earningsByCurrency.length > 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Earned {formatCurrencyBreakdown(category.earningsByCurrency)}
                    </p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[28px] border-slate-200 shadow-sm shadow-slate-200/60">
            <CardHeader className="border-slate-200">
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold text-slate-950">Top tasks</CardTitle>
                <p className="text-sm text-slate-600">
                  The tasks below absorbed the most weekly effort across scheduled and tracked work.
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-200">
                {review.topTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700">
                        {index + 1}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-950">{task.title}</p>
                          <TaskStatusPill status={task.status} />
                        </div>
                        <p className="text-sm text-slate-500">
                          {[task.projectName, task.categoryName].filter(Boolean).join(' • ') ||
                            'Unassigned work'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <MetricChip label="Scheduled" value={formatMinutes(task.plannedMinutes)} />
                      <MetricChip label="Actual" value={formatMinutes(task.actualMinutes)} />
                      <VarianceChip minutes={task.varianceMinutes} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden rounded-[28px] border-slate-200 shadow-sm shadow-slate-200/60">
            <CardHeader className="border-slate-200">
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold text-slate-950">
                  Summary insights
                </CardTitle>
                <p className="text-sm text-slate-600">
                  The strongest weekly signals at a glance.
                </p>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <InsightTile
                icon={Layers3}
                title="Top category"
                value={review.summary.topCategoryName}
                detail={
                  topCategory
                    ? `${topCategory.actualHours.toFixed(1)}h tracked across ${topCategory.blockCount} blocks`
                    : review.insights[1]?.detail ?? 'No category signal yet.'
                }
              />
              <InsightTile
                icon={Tags}
                title="Top tag"
                value={review.summary.topTagName}
                detail={
                  topTag
                    ? `${topTag.actualHours.toFixed(1)}h of tagged work this week`
                    : review.insights[2]?.detail ?? 'No tag signal yet.'
                }
              />
              <InsightTile
                icon={Clock3}
                title="Focus day"
                value={review.summary.mostFocusedDay.day}
                detail={`${formatMinutes(review.summary.mostFocusedDay.actualMinutes)} tracked`}
              />
              <InsightTile
                icon={AlertCircle}
                title="Planning gap"
                value={`${review.summary.unscheduledTasks} open`}
                detail={
                  review.summary.unscheduledTasks > 0
                    ? 'Tasks still waiting for a real calendar slot'
                    : 'Every open task already has time blocked'
                }
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[28px] border-slate-200 shadow-sm shadow-slate-200/60">
            <CardHeader className="border-slate-200">
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold text-slate-950">
                  Time by day of week
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Daily bars show where the week loaded up fastest.
                </p>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-6">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dayOfWeekData} barGap={6}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(value: number) => `${value}h`}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => formatTooltipHours(value)}
                    contentStyle={{
                      borderRadius: 16,
                      borderColor: '#e2e8f0',
                      boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                    }}
                  />
                  <Bar
                    dataKey="scheduledHours"
                    name="Scheduled"
                    fill="#cbd5e1"
                    radius={[10, 10, 0, 0]}
                  />
                  <Bar
                    dataKey="actualHours"
                    name="Actual"
                    fill="#0f766e"
                    radius={[10, 10, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[28px] border-slate-200 shadow-sm shadow-slate-200/60">
            <CardHeader className="border-slate-200">
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold text-slate-950">
                  Hours by tag
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Tags reveal the type of work hiding inside the broader category totals.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {review.tagBreakdown.map((tag) => (
                <div key={tag.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.fill }} />
                      <span className="text-sm font-medium text-slate-950">{tag.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-950">
                        {tag.actualHours.toFixed(1)}h
                      </p>
                      <p className="text-xs text-slate-500">
                        {tag.plannedHours.toFixed(1)}h on calendar
                      </p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: tag.fill,
                        width: `${Math.min(
                          tag.plannedHours === 0 ? 0 : (tag.actualHours / tag.plannedHours) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[28px] border-slate-200 shadow-sm shadow-slate-200/60">
            <CardHeader className="border-slate-200">
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold text-slate-950">
                  Top projects
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Project rollups show which workstreams took the most weekly attention.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {review.topProjects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-950">{project.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {project.taskCount} task{project.taskCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                      {project.completionRate}% execution
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Scheduled</span>
                    <span className="font-medium text-slate-950">
                      {formatMinutes(project.plannedMinutes)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Actual</span>
                    <span className="font-medium text-slate-950">
                      {formatMinutes(project.actualMinutes)}
                    </span>
                  </div>
                  {project.earningsByCurrency.length > 0 ? (
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-slate-500">Earnings</span>
                      <span className="font-medium text-slate-950">
                        {formatCurrencyBreakdown(project.earningsByCurrency)}
                      </span>
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function MetricTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'green' | 'amber' | 'slate';
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    slate: 'border-slate-200 bg-white text-slate-900',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-[0.12em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm opacity-70">{detail}</p>
    </div>
  );
}

function InsightTile({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: typeof Layers3;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
            {title}
          </p>
          <p className="text-base font-semibold text-slate-950">{value}</p>
        </div>
        <div className="rounded-xl bg-white p-2 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
      <span className="text-slate-500">{label}</span> {value}
    </div>
  );
}

function TaskStatusPill({ status }: { status: string }) {
  const tones = {
    inbox: 'bg-slate-100 text-slate-700',
    next: 'bg-blue-100 text-blue-700',
    doing: 'bg-violet-100 text-violet-700',
    waiting: 'bg-amber-100 text-amber-700',
    done: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        tones[status as keyof typeof tones] ?? tones.inbox
      }`}
    >
      {status}
    </span>
  );
}

function VarianceChip({ minutes }: { minutes: number }) {
  const tone =
    minutes > 0
      ? 'bg-amber-100 text-amber-800'
      : minutes < 0
        ? 'bg-emerald-100 text-emerald-800'
        : 'bg-slate-100 text-slate-700';

  return (
    <div className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>
      {formatSignedMinutes(minutes)}
    </div>
  );
}

function toHours(minutes: number) {
  return Number((minutes / 60).toFixed(1));
}

function formatSignedMinutes(minutes: number) {
  if (minutes === 0) {
    return '0m';
  }

  const prefix = minutes > 0 ? '+' : '-';
  return `${prefix}${formatMinutes(Math.abs(minutes))}`;
}

function formatTooltipHours(
  value: number | string | ReadonlyArray<number | string> | undefined
) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const numeric =
    typeof rawValue === 'number' ? rawValue : rawValue ? Number(rawValue) : 0;
  return `${numeric.toFixed(1)}h`;
}
