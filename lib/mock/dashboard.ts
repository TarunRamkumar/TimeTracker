import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { DEFAULT_CATEGORIES } from '../domain/constants';
import type {
  Category,
  DashboardStats,
  Project,
  ProjectId,
  Tag,
  Task,
  TimeBlock,
  TimerSession,
} from '../domain/types';
import {
  calculateTimeBlockEarnings,
  formatMinutes,
  getCategoryLineageIds,
  getCategoryPathLabel,
  getTimeBlockActualMinutes,
  getTimeBlockScheduledMinutes,
  resolveTimeBlockCurrency,
  sumCurrencyAmounts,
  type CurrencyAmount,
} from '../domain/helpers';
import { MOCK_PROJECTS, MOCK_TAGS, MOCK_TASKS } from './tasks';
import { MOCK_TIME_BLOCKS } from './time-blocks';
import { MOCK_TIMER_SESSIONS } from './sessions';

const WEEK_STARTS_ON = 1 as const;

type WeeklyTaskRecord = { rawTask: Task };

export interface ReviewDataOptions {
  now?: Date;
  categories?: Category[];
  tags?: Tag[];
  tasks?: Task[];
  timeBlocks?: TimeBlock[];
  timerSessions?: TimerSession[];
  projects?: Project[];
}

export interface ReviewDay {
  date: Date;
  day: string;
  shortDay: string;
  plannedMinutes: number;
  actualMinutes: number;
  blockCount: number;
  executionRate: number;
  cumulativePlannedMinutes: number;
  cumulativeActualMinutes: number;
}

export interface ReviewCategory {
  id: string;
  name: string;
  fill: string;
  plannedHours: number;
  actualHours: number;
  blockCount: number;
  executionRate: number;
  earningsByCurrency: CurrencyAmount[];
}

export interface ReviewTag {
  id: string;
  name: string;
  fill: string;
  plannedHours: number;
  actualHours: number;
}

export interface ReviewTask {
  id: string;
  title: string;
  projectId?: ProjectId;
  projectName?: string;
  categoryName?: string;
  plannedMinutes: number;
  actualMinutes: number;
  varianceMinutes: number;
  status: Task['status'];
  earningsByCurrency: CurrencyAmount[];
}

export interface ReviewProject {
  id: string;
  name: string;
  plannedMinutes: number;
  actualMinutes: number;
  taskCount: number;
  completionRate: number;
  earningsByCurrency: CurrencyAmount[];
}

export interface WeeklyReviewSummary {
  plannedMinutes: number;
  actualMinutes: number;
  varianceMinutes: number;
  executionRate: number;
  completedTasksThisWeek: number;
  scheduledTasksThisWeek: number;
  unscheduledTasks: number;
  topCategoryName: string;
  topTagName: string;
  mostFocusedDay: {
    day: string;
    actualMinutes: number;
  };
  topTaskTitle: string;
  topProjectName: string;
  earningsByCurrency: CurrencyAmount[];
}

export interface WeeklyReviewInsight {
  title: string;
  detail: string;
}

export interface WeeklyReviewData {
  weekLabel: string;
  summary: WeeklyReviewSummary;
  dayBreakdown: ReviewDay[];
  categoryBreakdown: ReviewCategory[];
  tagBreakdown: ReviewTag[];
  topTasks: ReviewTask[];
  topProjects: ReviewProject[];
  insights: WeeklyReviewInsight[];
}

function getReviewSources(options: ReviewDataOptions = {}) {
  return {
    now: options.now ?? new Date(),
    categories: options.categories ?? DEFAULT_CATEGORIES,
    tags: options.tags ?? MOCK_TAGS,
    tasks: options.tasks ?? MOCK_TASKS,
    timeBlocks: options.timeBlocks ?? MOCK_TIME_BLOCKS,
    timerSessions: options.timerSessions ?? MOCK_TIMER_SESSIONS,
    projects: options.projects ?? MOCK_PROJECTS,
  };
}

function getWeekBounds(now: Date) {
  const weekStart = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  return { weekStart, weekEnd };
}

function toBlockEarnings(
  block: TimeBlock,
  categoriesById: Map<Category['id'], Category>
): CurrencyAmount[] {
  const category = categoriesById.get(block.categoryId);
  const amount = calculateTimeBlockEarnings(block, category);

  if (amount === null || amount <= 0) {
    return [];
  }

  return [
    {
      amount,
      currency: resolveTimeBlockCurrency(block, category),
    },
  ];
}

function getCalendarSummaryBlocks(timeBlocks: TimeBlock[]) {
  const blockIds = new Set(timeBlocks.map((block) => block.id));

  return timeBlocks.filter((block) => !block.parentBlockId || !blockIds.has(block.parentBlockId));
}

function getWeeklyCollections(options: ReviewDataOptions = {}) {
  const { now, tasks, timeBlocks } = getReviewSources(options);
  const { weekStart, weekEnd } = getWeekBounds(now);

  const weekBlocks = timeBlocks.filter(
    (block) => block.start >= weekStart && block.start <= weekEnd && block.status !== 'cancelled'
  );
  const calendarSummaryBlocks = getCalendarSummaryBlocks(weekBlocks);

  const linkedTaskIds = new Set(
    weekBlocks
      .map((block) => block.taskId)
      .filter((taskId): taskId is Task['id'] => Boolean(taskId))
  );

  const reviewTasks: WeeklyTaskRecord[] = tasks
    .filter((task) => {
      const references = [task.dueDate, task.scheduledStart, task.updatedAt, task.createdAt].filter(
        (value): value is Date => Boolean(value)
      );

      return (
        linkedTaskIds.has(task.id) ||
        references.some((date) => date >= weekStart && date <= weekEnd)
      );
    })
    .map((rawTask) => ({ rawTask }));

  return { weekStart, weekEnd, weekBlocks, calendarSummaryBlocks, reviewTasks };
}

export function getDashboardStats(options: ReviewDataOptions = {}): DashboardStats {
  const { now, categories, timerSessions } = getReviewSources(options);
  const today = startOfDay(now);
  const { calendarSummaryBlocks, reviewTasks } = getWeeklyCollections(options);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const categoryBreakdown = buildCategoryBreakdown(calendarSummaryBlocks, categories);

  const todayBlocks = calendarSummaryBlocks.filter(
    (block) => startOfDay(block.start).getTime() === today.getTime() && block.status !== 'cancelled'
  );

  const plannedMinutes = calendarSummaryBlocks.reduce(
    (sum, block) => sum + getTimeBlockScheduledMinutes(block),
    0
  );
  const actualMinutes = calendarSummaryBlocks.reduce(
    (sum, block) => sum + getTimeBlockActualMinutes(block),
    0
  );

  const todayTasks = reviewTasks
    .filter(
      (task) => task.rawTask.dueDate && startOfDay(task.rawTask.dueDate).getTime() === today.getTime()
    )
    .map((task) => task.rawTask);

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentSessions = timerSessions.filter((session) => session.startTime >= weekAgo);

  const completedTasks = reviewTasks.filter((task) => task.rawTask.status === 'done').length;
  const completionRate =
    reviewTasks.length > 0 ? Math.round((completedTasks / reviewTasks.length) * 100) : 0;

  const topCategory = categoryBreakdown[0]
    ? categoriesById.get(categoryBreakdown[0].id as Category['id'])
    : undefined;
  const earningsByCurrency = sumCurrencyAmounts(
    calendarSummaryBlocks.flatMap((block) => toBlockEarnings(block, categoriesById))
  );

  return {
    plannedHours: plannedMinutes / 60,
    actualHours: actualMinutes / 60,
    completionRate,
    topCategory,
    todayBlocks,
    todayTasks,
    recentSessions,
    earningsByCurrency,
  };
}

export function getWeeklyAnalytics(options: ReviewDataOptions = {}) {
  const review = getWeeklyReviewData(options);

  return {
    hoursPerDay: review.dayBreakdown.map((day) => ({
      day: day.shortDay,
      hours: Number((day.plannedMinutes / 60).toFixed(1)),
    })),
    categoryHours: review.categoryBreakdown
      .map((category) => ({
        name: category.name,
        hours: category.actualHours,
        fill: category.fill,
      }))
      .filter((item) => item.hours > 0),
  };
}

export function getCategoryBreakdown(options: ReviewDataOptions = {}) {
  const review = getWeeklyReviewData(options);
  const { categories } = getReviewSources(options);

  return review.categoryBreakdown.map((category) => ({
    category: categories.find((item) => item.id === category.id) ?? categories[0] ?? DEFAULT_CATEGORIES[0],
    plannedHours: category.plannedHours,
    actualHours: category.actualHours,
    blockCount: category.blockCount,
    earningsByCurrency: category.earningsByCurrency,
  }));
}

export function getWeeklyReviewData(options: ReviewDataOptions = {}): WeeklyReviewData {
  const sources = getReviewSources(options);
  const { weekStart, weekEnd, weekBlocks, calendarSummaryBlocks, reviewTasks } = getWeeklyCollections(options);

  const dayBreakdown = buildDayBreakdown(calendarSummaryBlocks, weekStart, weekEnd);
  const categoryBreakdown = buildCategoryBreakdown(calendarSummaryBlocks, sources.categories);
  const tagBreakdown = buildTagBreakdown(calendarSummaryBlocks, reviewTasks, sources.tags);
  const taskBreakdown = buildTaskBreakdown(
    reviewTasks,
    weekBlocks,
    sources.categories,
    sources.projects
  );
  const projectBreakdown = buildProjectBreakdown(taskBreakdown, sources.projects);

  const plannedMinutes = calendarSummaryBlocks.reduce(
    (sum, block) => sum + getTimeBlockScheduledMinutes(block),
    0
  );
  const actualMinutes = calendarSummaryBlocks.reduce(
    (sum, block) => sum + getTimeBlockActualMinutes(block),
    0
  );
  const varianceMinutes = actualMinutes - plannedMinutes;
  const executionRate =
    plannedMinutes === 0 ? 0 : Math.round((actualMinutes / plannedMinutes) * 100);

  const completedTasksThisWeek = reviewTasks.filter(
    (task) =>
      task.rawTask.status === 'done' &&
      task.rawTask.updatedAt >= weekStart &&
      task.rawTask.updatedAt <= weekEnd
  ).length;

  const scheduledTasksThisWeek = reviewTasks.filter(
    (task) => task.rawTask.scheduledStart && task.rawTask.scheduledEnd
  ).length;

  const unscheduledTasks = reviewTasks.filter(
    (task) => task.rawTask.status !== 'done' && !task.rawTask.scheduledStart
  ).length;

  const mostFocusedDay =
    [...dayBreakdown].sort((left, right) => right.actualMinutes - left.actualMinutes)[0] ??
    dayBreakdown[0];
  const topCategory = categoryBreakdown[0];
  const topTag = tagBreakdown[0];
  const topTask = taskBreakdown[0];
  const topProject = projectBreakdown[0];
  const earningsByCurrency = sumCurrencyAmounts(
    categoryBreakdown.flatMap((category) => category.earningsByCurrency)
  );

  return {
    weekLabel: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
    summary: {
      plannedMinutes,
      actualMinutes,
      varianceMinutes,
      executionRate,
      completedTasksThisWeek,
      scheduledTasksThisWeek,
      unscheduledTasks,
      topCategoryName: topCategory?.name ?? 'N/A',
      topTagName: topTag?.name ?? 'N/A',
      mostFocusedDay: {
        day: mostFocusedDay?.day ?? 'N/A',
        actualMinutes: mostFocusedDay?.actualMinutes ?? 0,
      },
      topTaskTitle: topTask?.title ?? 'N/A',
      topProjectName: topProject?.name ?? 'N/A',
      earningsByCurrency,
    },
    dayBreakdown,
    categoryBreakdown,
    tagBreakdown,
    topTasks: taskBreakdown.slice(0, 5),
    topProjects: projectBreakdown.slice(0, 5),
    insights: buildInsights({
      varianceMinutes,
      topCategory,
      topTag,
      mostFocusedDay,
      unscheduledTasks,
      topTask,
    }),
  };
}

function buildDayBreakdown(weekBlocks: TimeBlock[], weekStart: Date, weekEnd: Date): ReviewDay[] {
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  let cumulativePlannedMinutes = 0;
  let cumulativeActualMinutes = 0;

  return days.map((date) => {
    const dayBlocks = weekBlocks.filter((block) => isSameDay(block.start, date));
    const plannedMinutes = dayBlocks.reduce(
      (sum, block) => sum + getTimeBlockScheduledMinutes(block),
      0
    );
    const actualMinutes = dayBlocks.reduce(
      (sum, block) => sum + getTimeBlockActualMinutes(block),
      0
    );

    cumulativePlannedMinutes += plannedMinutes;
    cumulativeActualMinutes += actualMinutes;

    return {
      date,
      day: format(date, 'EEEE'),
      shortDay: format(date, 'EEE'),
      plannedMinutes,
      actualMinutes,
      blockCount: dayBlocks.length,
      executionRate: plannedMinutes === 0 ? 0 : Math.round((actualMinutes / plannedMinutes) * 100),
      cumulativePlannedMinutes,
      cumulativeActualMinutes,
    };
  });
}

function buildCategoryBreakdown(
  weekBlocks: TimeBlock[],
  categories: Category[]
): ReviewCategory[] {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const aggregates = new Map<
    string,
    {
      category: Category;
      plannedMinutes: number;
      actualMinutes: number;
      blockCount: number;
      earningsByCurrency: CurrencyAmount[];
    }
  >();

  for (const block of weekBlocks) {
    const lineageIds = getCategoryLineageIds(categories, block.categoryId);

    for (const categoryId of lineageIds) {
      const category = categoriesById.get(categoryId);
      if (!category) {
        continue;
      }

      const aggregate = aggregates.get(category.id) ?? {
        category,
        plannedMinutes: 0,
        actualMinutes: 0,
        blockCount: 0,
        earningsByCurrency: [],
      };

      aggregate.plannedMinutes += getTimeBlockScheduledMinutes(block);
      aggregate.actualMinutes += getTimeBlockActualMinutes(block);
      aggregate.blockCount += 1;
      aggregate.earningsByCurrency = sumCurrencyAmounts([
        ...aggregate.earningsByCurrency,
        ...toBlockEarnings(block, categoriesById),
      ]);
      aggregates.set(category.id, aggregate);
    }
  }

  return Array.from(aggregates.values())
    .map(({ category, plannedMinutes, actualMinutes, blockCount, earningsByCurrency }) => ({
      id: category.id,
      name: getCategoryPathLabel(categories, category.id) || category.name,
      fill: category.color,
      plannedHours: Number((plannedMinutes / 60).toFixed(1)),
      actualHours: Number((actualMinutes / 60).toFixed(1)),
      blockCount,
      executionRate: plannedMinutes === 0 ? 0 : Math.round((actualMinutes / plannedMinutes) * 100),
      earningsByCurrency,
    }))
    .filter((category) => category.blockCount > 0)
    .sort((left, right) => right.actualHours - left.actualHours);
}

function buildTagBreakdown(
  weekBlocks: TimeBlock[],
  reviewTasks: WeeklyTaskRecord[],
  tags: Tag[]
): ReviewTag[] {
  const taskMap = new Map(reviewTasks.map((task) => [task.rawTask.id, task.rawTask]));
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const aggregates = new Map<
    string,
    {
      tag: Tag;
      plannedMinutes: number;
      actualMinutes: number;
    }
  >();

  for (const block of weekBlocks) {
    const linkedTask = block.taskId ? taskMap.get(block.taskId) : undefined;
    const tagIds = block.tagIds.length > 0 ? block.tagIds : linkedTask?.tagIds ?? [];
    if (tagIds.length === 0) {
      continue;
    }

    const shareCount = tagIds.length;

    for (const tagId of tagIds) {
      const tag = tagMap.get(tagId);
      if (!tag) {
        continue;
      }

      const aggregate = aggregates.get(tag.id) ?? {
        tag,
        plannedMinutes: 0,
        actualMinutes: 0,
      };

      aggregate.plannedMinutes += getTimeBlockScheduledMinutes(block) / shareCount;
      aggregate.actualMinutes += getTimeBlockActualMinutes(block) / shareCount;
      aggregates.set(tag.id, aggregate);
    }
  }

  return Array.from(aggregates.values())
    .map(({ tag, plannedMinutes, actualMinutes }) => ({
      id: tag.id,
      name: tag.name,
      fill: tag.color,
      plannedHours: Number((plannedMinutes / 60).toFixed(1)),
      actualHours: Number((actualMinutes / 60).toFixed(1)),
    }))
    .sort((left, right) => right.actualHours - left.actualHours)
    .slice(0, 6);
}

function buildTaskBreakdown(
  reviewTasks: WeeklyTaskRecord[],
  weekBlocks: TimeBlock[],
  categories: Category[],
  projects: Project[]
): ReviewTask[] {
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  return reviewTasks
    .map(({ rawTask }) => {
      const linkedBlocks = weekBlocks.filter((block) => block.taskId === rawTask.id);
      const blockPlannedMinutes = linkedBlocks.reduce(
        (sum, block) => sum + getTimeBlockScheduledMinutes(block),
        0
      );
      const blockActualMinutes = linkedBlocks.reduce(
        (sum, block) => sum + getTimeBlockActualMinutes(block),
        0
      );
      const plannedMinutes = Math.max(rawTask.estimatedMinutes ?? 0, blockPlannedMinutes);
      const actualMinutes = Math.max(rawTask.actualMinutes, blockActualMinutes);
      const earningsByCurrency = sumCurrencyAmounts(
        linkedBlocks.flatMap((block) => toBlockEarnings(block, categoryMap))
      );

      return {
        id: rawTask.id,
        title: rawTask.title,
        projectId: rawTask.projectId,
        projectName: rawTask.projectId ? projectMap.get(rawTask.projectId)?.name : undefined,
        categoryName: getCategoryPathLabel(categories, rawTask.categoryId),
        plannedMinutes,
        actualMinutes,
        varianceMinutes: actualMinutes - plannedMinutes,
        status: rawTask.status,
        earningsByCurrency,
      };
    })
    .filter((task) => task.plannedMinutes > 0 || task.actualMinutes > 0)
    .sort((left, right) => {
      if (right.actualMinutes !== left.actualMinutes) {
        return right.actualMinutes - left.actualMinutes;
      }

      return right.plannedMinutes - left.plannedMinutes;
    });
}

function buildProjectBreakdown(
  taskBreakdown: ReviewTask[],
  projects: Project[]
): ReviewProject[] {
  const aggregates = new Map<string, ReviewProject>();

  for (const project of projects) {
    aggregates.set(project.id, {
      id: project.id,
      name: project.name,
      plannedMinutes: 0,
      actualMinutes: 0,
      taskCount: 0,
      completionRate: 0,
      earningsByCurrency: [],
    });
  }

  for (const task of taskBreakdown) {
    if (!task.projectId) {
      continue;
    }

    const current = aggregates.get(task.projectId);
    if (!current) {
      continue;
    }

    current.plannedMinutes += task.plannedMinutes;
    current.actualMinutes += task.actualMinutes;
    current.taskCount += 1;
    current.completionRate =
      current.plannedMinutes === 0
        ? 0
        : Math.round((current.actualMinutes / current.plannedMinutes) * 100);
    current.earningsByCurrency = sumCurrencyAmounts([
      ...current.earningsByCurrency,
      ...task.earningsByCurrency,
    ]);
    aggregates.set(task.projectId, current);
  }

  return Array.from(aggregates.values())
    .filter((project) => project.taskCount > 0)
    .sort((left, right) => {
      if (right.actualMinutes !== left.actualMinutes) {
        return right.actualMinutes - left.actualMinutes;
      }

      return right.plannedMinutes - left.plannedMinutes;
    });
}

function buildInsights({
  varianceMinutes,
  topCategory,
  topTag,
  mostFocusedDay,
  unscheduledTasks,
  topTask,
}: {
  varianceMinutes: number;
  topCategory?: ReviewCategory;
  topTag?: ReviewTag;
  mostFocusedDay?: ReviewDay;
  unscheduledTasks: number;
  topTask?: ReviewTask;
}): WeeklyReviewInsight[] {
  const scheduleInsight =
    varianceMinutes >= 0
      ? `You tracked ${formatMinutes(varianceMinutes)} more than was on the calendar this week.`
      : `You finished ${formatMinutes(Math.abs(varianceMinutes))} under the calendar this week.`;

  const categoryInsight = topCategory
    ? `${topCategory.name} led the week with ${topCategory.actualHours.toFixed(1)}h recorded.`
    : 'No category signal yet.';

  const tagInsight = topTag
    ? `${topTag.name} was the heaviest tag at ${topTag.actualHours.toFixed(1)}h.`
    : 'No tag-heavy work showed up this week.';

  const cadenceInsight = mostFocusedDay
    ? `${mostFocusedDay.day} was your busiest day with ${formatMinutes(
        mostFocusedDay.actualMinutes
      )} tracked.`
    : 'No strong day-of-week signal yet.';

  const planningInsight =
    unscheduledTasks > 0
      ? `${unscheduledTasks} open tasks still need a concrete time block.`
      : 'Every open task already has a calendar slot.';

  const taskInsight = topTask
    ? `${topTask.title} absorbed the most attention at ${formatMinutes(topTask.actualMinutes)}.`
    : 'No task stood out this week.';

  return [
    { title: 'Schedule vs reality', detail: scheduleInsight },
    { title: 'Category signal', detail: categoryInsight },
    { title: 'Tag signal', detail: tagInsight },
    { title: 'Cadence', detail: cadenceInsight },
    { title: 'Planning gap', detail: planningInsight },
    { title: 'Top task', detail: taskInsight },
  ];
}
