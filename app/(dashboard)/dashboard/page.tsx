'use client';

import { getDashboardStats, getWeeklyAnalytics } from '@/lib/mock/dashboard';
import { TaskForm } from '@/components/forms';
import { useAppData } from '@/components/providers/AppDataProvider';
import { useCategories } from '@/components/providers/CategoriesProvider';
import { useTaskForm } from '@/hooks/useForms';
import { buildTaskFromFormValues } from '@/lib/forms/mappers';
import type { TaskFormValues } from '@/lib/forms/schemas';
import { Card, CardContent, CardHeader, CardTitle, StatCard, Button } from '@/components/ui';
import { TaskItem } from '@/components/shared/TaskComponents';
import { TimerWidget } from '@/components/shared/TimerWidget';
import { WeekProgressCard } from '@/components/shared/WeekProgressCard';
import { PageShell } from '@/components/layout/PageShell';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  calculateTimeBlockEarnings,
  formatCurrencyBreakdown,
  formatMinutes,
  getTimeBlockScheduledMinutes,
  getTodayLabel,
  resolveTimeBlockCurrency,
} from '@/lib/domain/helpers';
import { format, isSameDay } from 'date-fns';
import { Plus } from 'lucide-react';
import type { Task } from '@/lib/domain/types';

export default function Dashboard() {
  const taskForm = useTaskForm<Task>();
  const { categories } = useCategories();
  const { tasks, timeBlocks, timerSessions, projects, tags, upsertTask } = useAppData();
  const stats = getDashboardStats({
    categories,
    projects,
    tags,
    tasks,
    timeBlocks,
    timerSessions,
  });
  const { hoursPerDay, categoryHours } = getWeeklyAnalytics({
    categories,
    projects,
    tags,
    tasks,
    timeBlocks,
    timerSessions,
  });

  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const todayTasks = tasks.filter((task) => task.dueDate && isSameDay(task.dueDate, new Date()));
  const todayBlockIds = new Set(timeBlocks.map((block) => block.id));
  const todayBlocks = timeBlocks.filter(
    (block) =>
      isSameDay(block.start, new Date()) &&
      (!block.parentBlockId || !todayBlockIds.has(block.parentBlockId))
  );

  const handleTaskSubmit = async (data: TaskFormValues) => {
    const nextTask = buildTaskFromFormValues(data, taskForm.initialData);
    upsertTask(nextTask);
  };

  return (
    <PageShell>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">{getTodayLabel()}</p>
        </div>
        <Button variant="primary" onClick={() => taskForm.openCreate()} className="shrink-0">
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Scheduled Hours"
          value={stats.plannedHours.toFixed(1)}
          color="blue"
        />
        <StatCard
          title="Tracked Hours"
          value={stats.actualHours.toFixed(1)}
          color="green"
        />
        <StatCard
          title="Completion Rate"
          value={`${stats.completionRate}%`}
          color="purple"
        />
        <StatCard
          title="Week earnings"
          value={
            stats.earningsByCurrency.length > 0
              ? formatCurrencyBreakdown(stats.earningsByCurrency)
              : 'No paid time'
          }
          color="amber"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {todayBlocks.length === 0 ? (
                <p className="text-gray-500 text-sm">No calendar events scheduled for today</p>
              ) : (
                <div className="space-y-3">
                  {todayBlocks.map((block) => {
                    const usesActualTime = !block.taskId && block.status === 'completed';
                    const blockEarnings = calculateTimeBlockEarnings(
                      block,
                      categoryMap.get(block.categoryId)
                    );

                    return (
                      <div
                        key={block.id}
                        className="p-3 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-gray-900 text-sm">{block.title}</h4>
                          <span
                            className="text-xs px-2 py-1 rounded text-white"
                            style={{ backgroundColor: categoryMap.get(block.categoryId)?.color }}
                          >
                            {categoryMap.get(block.categoryId)?.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>
                            {format(block.start, 'h:mm a')} - {format(block.end, 'h:mm a')}
                          </span>
                          <span>
                            {formatMinutes(
                              usesActualTime
                                ? block.actualMinutes
                                : getTimeBlockScheduledMinutes(block)
                            )}{' '}
                            {usesActualTime ? 'actual' : 'scheduled'}
                          </span>
                        </div>
                        {blockEarnings !== null && blockEarnings > 0 ? (
                          <div className="mt-2 text-xs text-slate-500">
                            Earns{' '}
                            {formatCurrencyBreakdown([
                              {
                                amount: blockEarnings,
                                currency: resolveTimeBlockCurrency(
                                  block,
                                  categoryMap.get(block.categoryId)
                                ),
                              },
                            ])}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Hours by Day</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hoursPerDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <WeekProgressCard
            title="Time completion"
            description="Switch between a live view of the current day and the current week."
          />

          {/* Timer */}
          <TimerWidget />

          {/* Today's Tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {todayTasks.length === 0 ? (
                <p className="text-gray-500 text-xs">No tasks for today</p>
              ) : (
                <div className="space-y-2">
                  {todayTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      category={categoryMap.get(task.categoryId)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          {categoryHours.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Hours by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryHours}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name} ${value}h`}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="hours"
                    >
                      {categoryHours.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Recent Sessions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {timerSessions.length === 0 ? (
                <p className="text-gray-500 text-xs">No sessions yet</p>
              ) : (
                <div className="space-y-2">
                  {timerSessions.slice(0, 5).map((session) => (
                    <div key={session.id} className="text-xs p-2 bg-gray-50 rounded">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-900">
                          {categoryMap.get(session.categoryId)?.name}
                        </span>
                        <span className="text-gray-600">{formatMinutes(session.durationMinutes)}</span>
                      </div>
                      <div className="text-gray-500">{format(session.startTime, 'MMM d, h:mm a')}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <TaskForm
        open={taskForm.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            taskForm.close();
          }
        }}
        mode={taskForm.mode}
        initialData={taskForm.initialData}
        categories={categories}
        projects={projects}
        tags={tags}
        timeBlocks={timeBlocks}
        onSubmit={handleTaskSubmit}
      />
    </PageShell>
  );
}
