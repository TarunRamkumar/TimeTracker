'use client';

import { useEffect, useState } from 'react';
import { add, differenceInMinutes, format, startOfDay } from 'date-fns';
import {
  CalendarClock,
  Clock3,
  Copy,
  LayoutGrid,
  List,
  FolderPlus,
  Search,
  Target,
  Timer,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { ProjectForm, TaskForm } from '@/components/forms';
import { useAppData } from '@/components/providers/AppDataProvider';
import { useCategories } from '@/components/providers/CategoriesProvider';
import { TaskCard } from '@/components/shared/TaskComponents';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui';
import { PageShell } from '@/components/layout/PageShell';
import { useProjectForm, useTaskForm } from '@/hooks/useForms';
import { buildProjectFromFormValues, buildTaskFromFormValues } from '@/lib/forms/mappers';
import type { ProjectFormValues, TaskFormValues } from '@/lib/forms/schemas';
import {
  formatMinutes,
  getCategoryPathLabel,
  groupTasksByStatus,
  isCategoryWithinBranch,
} from '@/lib/domain/helpers';
import type { Project, Tag, Task, TaskId, TaskStatus } from '@/lib/domain/types';

type ViewMode = 'kanban' | 'list';
type PlanningFilter = 'all' | 'scheduled' | 'unscheduled';
type ProjectContextMenuState = {
  project: Project;
  x: number;
  y: number;
};

const KANBAN_COLUMNS: Array<{
  key: TaskStatus;
  title: string;
  description: string;
  tone: string;
}> = [
  {
    key: 'inbox',
    title: 'Inbox',
    description: 'Needs clarification or a real plan.',
    tone: 'from-slate-100 to-slate-50',
  },
  {
    key: 'next',
    title: 'Next',
    description: 'Clear next actions ready to schedule.',
    tone: 'from-sky-100 to-cyan-50',
  },
  {
    key: 'doing',
    title: 'Doing',
    description: 'Already in motion or actively tracked.',
    tone: 'from-violet-100 to-indigo-50',
  },
  {
    key: 'waiting',
    title: 'Waiting',
    description: 'Blocked on someone else or a future moment.',
    tone: 'from-amber-100 to-yellow-50',
  },
  {
    key: 'done',
    title: 'Done',
    description: 'Completed work with actual effort recorded.',
    tone: 'from-emerald-100 to-green-50',
  },
];

export default function TasksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [planningFilter, setPlanningFilter] = useState<PlanningFilter>('all');
  const [query, setQuery] = useState('');
  const [projectContextMenu, setProjectContextMenu] = useState<ProjectContextMenuState | null>(
    null
  );

  const taskForm = useTaskForm<Task>();
  const projectForm = useProjectForm<Project>();
  const { categories } = useCategories();
  const {
    tasks,
    timeBlocks,
    projects,
    tags,
    activeTimer,
    isTimerRunning,
    scheduleTaskOnCalendar,
    startTimer,
    resumeTimer,
    stopTimer,
    upsertProject,
    deleteProject,
    upsertTask,
    deleteTask,
    completeTask,
  } = useAppData();

  useEffect(() => {
    if (!projectContextMenu) {
      return;
    }

    const closeMenu = () => setProjectContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProjectContextMenu(null);
      }
    };

    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeMenu);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeMenu);
    };
  }, [projectContextMenu]);

  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const resolvedProjectFilter =
    projectFilter === 'all' || projects.some((project) => project.id === projectFilter)
      ? projectFilter
      : 'all';

  const openTasks = tasks.filter((task) => task.status !== 'done');
  const scheduledTasks = openTasks.filter((task) => task.scheduledStart && task.scheduledEnd);
  const totalEstimatedMinutes = openTasks.reduce(
    (sum, task) => sum + (task.estimatedMinutes ?? 0),
    0
  );
  const totalActualMinutes = openTasks.reduce((sum, task) => sum + task.actualMinutes, 0);
  const scheduledMinutes = scheduledTasks.reduce((sum, task) => sum + getScheduledMinutes(task), 0);

  const visibleTasks = tasks
    .filter((task) => {
      if (
        categoryFilter !== 'all' &&
        !isCategoryWithinBranch(categories, task.categoryId, categoryFilter as Task['categoryId'])
      ) {
        return false;
      }

      if (resolvedProjectFilter !== 'all' && task.projectId !== resolvedProjectFilter) {
        return false;
      }

      if (planningFilter === 'scheduled' && (!task.scheduledStart || !task.scheduledEnd)) {
        return false;
      }

      if (planningFilter === 'unscheduled' && task.scheduledStart && task.scheduledEnd) {
        return false;
      }

      if (!query.trim()) {
        return true;
      }

      const normalizedQuery = query.trim().toLowerCase();
      const projectName = task.projectId
        ? (projectMap.get(task.projectId)?.name.toLowerCase() ?? '')
        : '';
      const tagNames = task.tagIds
        .map((tagId) => tagMap.get(tagId)?.name.toLowerCase() ?? '')
        .join(' ');

      return [task.title, task.description, projectName, tagNames].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((left, right) => {
      if (left.status === 'done' && right.status !== 'done') {
        return 1;
      }

      if (left.status !== 'done' && right.status === 'done') {
        return -1;
      }

      const leftDue = left.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightDue = right.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftDue - rightDue;
    });

  const tasksByStatus = groupTasksByStatus(visibleTasks);

  const handleStartTimer = (task: Task) => {
    if (activeTimer?.taskId === task.id && !activeTimer.isRunning) {
      resumeTimer();
      return;
    }

    startTimer(task.id, task.calendarBlockId);
  };

  const handleScheduleTask = (taskId: TaskId) => {
    scheduleTaskOnCalendar(taskId);
  };

  const handleMarkDone = (taskId: TaskId) => {
    const task = tasks.find((currentTask) => currentTask.id === taskId);
    if (!task || task.status === 'done') {
      return;
    }

    completeTask(taskId);
  };

  const handleTaskFormSubmit = async (data: TaskFormValues) => {
    const nextTask = buildTaskFromFormValues(data, taskForm.initialData);
    upsertTask(nextTask);
  };

  const handleProjectFormSubmit = async (data: ProjectFormValues) => {
    const nextProject = buildProjectFromFormValues(data, projectForm.initialData);
    upsertProject(nextProject);
    setProjectFilter(nextProject.id);
  };

  const handleProjectDelete = async (project?: Project | null) => {
    if (!project) {
      return;
    }

    if (!window.confirm('Delete this project? Tasks will remain and be unassigned from the project.')) {
      return;
    }

    deleteProject(project.id);
    setProjectContextMenu(null);
    if (resolvedProjectFilter === project.id) {
      setProjectFilter('all');
    }
  };

  const handleProjectFormDelete = async () => {
    const projectId = projectForm.initialData?.id;
    if (!projectId) {
      return;
    }

    const project = projects.find((currentProject) => currentProject.id === projectId);
    await handleProjectDelete(project);
  };

  const handleProjectDuplicate = (project: Project) => {
    const nextProject = buildProjectFromFormValues(
      {
        name: getDuplicateProjectName(projects, project.name),
        description: project.description,
        status: project.status,
        categoryId: project.categoryId,
        startDate: project.startDate,
        endDate: project.endDate,
      },
      null
    );

    upsertProject(nextProject);
    setProjectFilter(nextProject.id);
    setProjectContextMenu(null);
  };

  const openProjectContextMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    project: Project
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 220;
    const menuHeight = 112;
    const safeX =
      typeof window === 'undefined'
        ? event.clientX
        : Math.min(Math.max(event.clientX, 12), Math.max(window.innerWidth - menuWidth - 12, 12));
    const safeY =
      typeof window === 'undefined'
        ? event.clientY
        : Math.min(Math.max(event.clientY, 12), Math.max(window.innerHeight - menuHeight - 12, 12));

    setProjectContextMenu({
      project,
      x: safeX,
      y: safeY,
    });
  };

  const handleTaskDelete = async () => {
    const taskId = taskForm.initialData?.id;
    if (!taskId) {
      return;
    }

    const taskToDelete = tasks.find((task) => task.id === taskId);
    if (!taskToDelete) {
      return;
    }

    if (activeTimer?.taskId === taskId) {
      stopTimer();
    }

    deleteTask(taskId);
  };

  return (
    <PageShell>
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f6fbff_48%,#f8fafc_100%)] shadow-sm shadow-slate-200/60">
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <CalendarClock className="h-3.5 w-3.5" />
              Tasks stay connected to calendar blocks and live work
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Tasks
              </h1>
              <p className="max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Plan work lightly, place it on the calendar when it matters, and keep tracked
                time tied to the task without exposing backend workflow details.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Open tasks"
              value={String(openTasks.length)}
              detail={`${visibleTasks.length} in current view`}
            />
            <MetricTile
              label="Calendar time"
              value={formatMinutes(scheduledMinutes)}
              detail={`${scheduledTasks.length} scheduled tasks`}
            />
            <MetricTile
              label="Estimated work"
              value={formatMinutes(totalEstimatedMinutes)}
              detail="Current remaining estimates"
            />
            <MetricTile
              label="Actual tracked"
              value={formatMinutes(totalActualMinutes)}
              detail="Recorded against open work"
            />
          </div>
        </div>
      </section>

      <Card className="rounded-[24px] border-slate-200 shadow-sm shadow-slate-200/60">
        <CardContent className="flex flex-col gap-4 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tasks, projects, or tags"
                  className="h-11 rounded-2xl border-slate-200 pl-9"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {getCategoryPathLabel(categories, category.id) || category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => taskForm.openCreate()}
                className="inline-flex items-center gap-2 rounded-full"
              >
                <Plus className="h-4 w-4" />
                New task
              </Button>
              {(['all', 'scheduled', 'unscheduled'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setPlanningFilter(filter)}
                  className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                    planningFilter === filter
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {filter === 'all'
                    ? 'All tasks'
                    : filter === 'scheduled'
                      ? 'On calendar'
                      : 'Needs planning'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {KANBAN_COLUMNS.map((column) => (
                <div
                  key={column.key}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600"
                >
                  {column.title}: {tasksByStatus[column.key].length}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
              {(['kanban', 'list'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    viewMode === mode
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode === 'kanban' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                  {mode === 'kanban' ? 'Kanban' : 'List'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setProjectFilter('all')}
                className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  resolvedProjectFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All projects
              </button>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setProjectFilter(project.id)}
                  onContextMenu={(event) => openProjectContextMenu(event, project)}
                  className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                    resolvedProjectFilter === project.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  {project.name}
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              onClick={() => projectForm.openCreate()}
              className="inline-flex items-center gap-2 rounded-full"
            >
              <FolderPlus className="h-4 w-4" />
              New project
            </Button>
          </div>
        </CardContent>
      </Card>

      {viewMode === 'kanban' ? (
        <div className="grid gap-4 xl:grid-cols-5">
          {KANBAN_COLUMNS.map((column) => {
            const columnTasks = tasksByStatus[column.key];
            const columnEstimate = columnTasks.reduce(
              (sum, task) => sum + (task.estimatedMinutes ?? 0),
              0
            );

            return (
              <section
                key={column.key}
                className={`rounded-[28px] border border-slate-200 bg-gradient-to-b ${column.tone} p-4 shadow-sm shadow-slate-200/50`}
              >
                <div className="mb-4 rounded-[22px] bg-white/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">{column.title}</h2>
                      <p className="mt-1 text-sm text-slate-600">{column.description}</p>
                    </div>
                    <Badge variant="default" className="bg-slate-900 text-white">
                      {columnTasks.length}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatMinutes(columnEstimate)}
                  </div>
                </div>

                <div className="space-y-3">
                  {columnTasks.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-slate-300 bg-white/80 px-4 py-6 text-sm text-slate-500">
                      No tasks in this column for the current filters.
                    </div>
                  ) : (
                    columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        category={categoryMap.get(task.categoryId)}
                        projectName={task.projectId ? projectMap.get(task.projectId)?.name : undefined}
                        tags={task.tagIds
                          .map((tagId) => tagMap.get(tagId))
                          .filter((tag): tag is Tag => Boolean(tag))}
                        onStartTimer={
                          task.status === 'done' ? undefined : () => handleStartTimer(task)
                        }
                        onStopTimer={
                          task.status === 'done'
                            ? undefined
                            : () =>
                                activeTimer?.taskId === task.id && !activeTimer.isRunning
                                  ? resumeTimer()
                                  : stopTimer()
                        }
                        onSchedule={
                          task.status === 'done' ? undefined : () => handleScheduleTask(task.id)
                        }
                        onMarkDone={() => handleMarkDone(task.id)}
                        isTimerActive={activeTimer?.taskId === task.id}
                        isTimerRunning={
                          activeTimer?.taskId === task.id ? isTimerRunning : false
                        }
                        onClick={() => taskForm.openEdit(task)}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden rounded-[28px] border-slate-200 shadow-sm shadow-slate-200/60">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-slate-950">Task table</CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full">
                <thead className="bg-slate-50 text-left">
                  <tr className="border-y border-slate-200 text-xs uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-6 py-4 font-medium">Task</th>
                    <th className="px-4 py-4 font-medium">Status</th>
                    <th className="px-4 py-4 font-medium">Due</th>
                    <th className="px-4 py-4 font-medium">Calendar</th>
                    <th className="px-4 py-4 font-medium">Estimate vs actual</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTasks.map((task) => {
                    const tags = task.tagIds
                      .map((tagId) => tagMap.get(tagId))
                      .filter((tag): tag is Tag => Boolean(tag));
                    const project = task.projectId ? projectMap.get(task.projectId) : undefined;
                    const timerActive = activeTimer?.taskId === task.id;

                    return (
                      <tr key={task.id} className="border-b border-slate-200 align-top last:border-b-0">
                        <td className="px-6 py-5">
                          <div className="max-w-[340px]">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: categoryMap.get(task.categoryId)?.color }}
                              />
                              <p className="font-medium text-slate-950">{task.title}</p>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {task.description}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {project ? (
                                <Badge variant="default" className="bg-slate-100 text-slate-700">
                                  {project.name}
                                </Badge>
                              ) : null}
                              <Badge variant="default" className="bg-slate-100 text-slate-700">
                                {getCategoryPathLabel(categories, task.categoryId) ||
                                  categoryMap.get(task.categoryId)?.name}
                              </Badge>
                              {tags.map((tag) => (
                                <Badge
                                  key={tag.id}
                                  variant="default"
                                  className="border border-slate-200 bg-white text-slate-600"
                                >
                                  {tag.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <div className="space-y-2">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusTone(
                                task.status
                              )}`}
                            >
                              {task.status}
                            </span>
                            {timerActive ? (
                              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                                <Timer className="h-3.5 w-3.5" />
                                {isTimerRunning ? 'Live' : 'Paused'}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-5 text-sm text-slate-600">
                          {task.dueDate ? formatDueLabel(task.dueDate) : 'No due date'}
                        </td>
                        <td className="px-4 py-5">
                          {task.scheduledStart && task.scheduledEnd ? (
                            <div className="text-sm text-slate-700">
                              <p className="font-medium text-slate-900">
                                {format(task.scheduledStart, 'EEE h:mm a')}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {format(task.scheduledEnd, 'h:mm a')} • {formatMinutes(getScheduledMinutes(task))}
                              </p>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                              <Target className="h-3.5 w-3.5" />
                              Needs planning
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-5">
                          <div className="min-w-[180px] space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500">
                                {task.estimatedMinutes ? formatMinutes(task.estimatedMinutes) : 'None'}
                              </span>
                              <span className="font-medium text-slate-900">
                                {formatMinutes(task.actualMinutes)}
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full ${
                                  task.estimatedMinutes && task.actualMinutes > task.estimatedMinutes
                                    ? 'bg-amber-500'
                                    : 'bg-blue-600'
                                }`}
                                style={{
                                  width: `${task.estimatedMinutes ? Math.min((task.actualMinutes / task.estimatedMinutes) * 100, 100) : 0}%`,
                                }}
                              />
                            </div>
                            <p className="text-xs font-medium text-slate-500">
                              {formatDeltaLabel(task)}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant={timerActive ? 'secondary' : 'primary'}
                              onClick={() =>
                                timerActive
                                  ? isTimerRunning
                                    ? stopTimer()
                                    : resumeTimer()
                                  : handleStartTimer(task)
                              }
                              className="rounded-full"
                              disabled={task.status === 'done'}
                            >
                              {timerActive ? (isTimerRunning ? 'Stop timer' : 'Resume timer') : 'Start timer'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => taskForm.openEdit(task)}
                              className="rounded-full border border-slate-200 bg-white"
                            >
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleScheduleTask(task.id)}
                              className="rounded-full border border-slate-200 bg-white"
                              disabled={task.status === 'done'}
                            >
                              {task.scheduledStart ? 'Reschedule' : 'Schedule'}
                            </Button>
                            <Button
                              size="sm"
                              variant={task.status === 'done' ? 'secondary' : 'ghost'}
                              onClick={() => handleMarkDone(task.id)}
                              className="rounded-full border border-slate-200 bg-white"
                              disabled={task.status === 'done'}
                            >
                              Done
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {projectContextMenu ? (
        <div
          className="fixed z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-300/40"
          style={{ left: projectContextMenu.x, top: projectContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            {projectContextMenu.project.name}
          </p>
          <button
            type="button"
            onClick={() => handleProjectDuplicate(projectContextMenu.project)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
          >
            <Copy className="h-4 w-4 text-slate-400" />
            Duplicate project
          </button>
          <button
            type="button"
            onClick={() => void handleProjectDelete(projectContextMenu.project)}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Delete project
          </button>
        </div>
      ) : null}

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
        onSubmit={handleTaskFormSubmit}
        onDelete={handleTaskDelete}
      />

      <ProjectForm
        open={projectForm.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            projectForm.close();
          }
        }}
        mode={projectForm.mode}
        initialData={projectForm.initialData}
        categories={categories}
        onSubmit={handleProjectFormSubmit}
        onDelete={handleProjectFormDelete}
      />
    </PageShell>
  );
}

function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm shadow-slate-200/60">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function getScheduledMinutes(task: Task) {
  if (!task.scheduledStart || !task.scheduledEnd) {
    return 0;
  }

  return differenceInMinutes(task.scheduledEnd, task.scheduledStart);
}

function formatDueLabel(date: Date) {
  if (format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
    return 'Today';
  }

  const tomorrow = add(startOfDay(new Date()), { days: 1 });
  if (format(date, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd')) {
    return 'Tomorrow';
  }

  return format(date, 'EEE, MMM d');
}

function formatDeltaLabel(task: Task) {
  const estimate = task.estimatedMinutes ?? 0;
  const delta = task.actualMinutes - estimate;

  if (estimate === 0 && task.actualMinutes === 0) {
    return 'No effort logged yet';
  }

  if (delta === 0) {
    return 'On plan';
  }

  return `${delta > 0 ? '+' : '-'}${formatMinutes(Math.abs(delta))}`;
}

function getStatusTone(status: TaskStatus) {
  if (status === 'doing') {
    return 'bg-violet-100 text-violet-700';
  }

  if (status === 'next') {
    return 'bg-blue-100 text-blue-700';
  }

  if (status === 'waiting') {
    return 'bg-amber-100 text-amber-700';
  }

  if (status === 'done') {
    return 'bg-emerald-100 text-emerald-700';
  }

  return 'bg-slate-100 text-slate-700';
}

function getDuplicateProjectName(projects: Project[], projectName: string) {
  const existingNames = new Set(projects.map((project) => project.name.toLowerCase()));
  const baseName = `${projectName} Copy`;

  if (!existingNames.has(baseName.toLowerCase())) {
    return baseName;
  }

  let copyNumber = 2;
  while (existingNames.has(`${baseName} ${copyNumber}`.toLowerCase())) {
    copyNumber += 1;
  }

  return `${baseName} ${copyNumber}`;
}
