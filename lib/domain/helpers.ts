import {
  Category,
  CategoryId,
  Project,
  ProjectBoundaryType,
  ProjectId,
  RecurringEditScope,
  RecurringDeleteScope,
  RecurringSeriesScope,
  Task,
  TimeBlockRecurrence,
  TimeBlock,
} from './types';
import {
  add,
  addDays,
  endOfDay,
  endOfWeek,
  format,
  isAfter,
  startOfDay,
  startOfWeek,
} from 'date-fns';

const WEEK_TOTAL_MINUTES = 7 * 24 * 60;
const DAY_TOTAL_MINUTES = 24 * 60;
const WEEK_STARTS_ON = 1 as const;
const WEEKDAY_LABELS: Record<TimeBlockRecurrence['daysOfWeek'][number], string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export interface TimeProgressSnapshot {
  start: Date;
  end: Date;
  totalMinutes: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  percentComplete: number;
  state: 'future' | 'current' | 'past';
  scope: 'day' | 'week';
}

export interface CurrencyAmount {
  amount: number;
  currency: string;
}

const DEFAULT_CURRENCY = 'USD';

export function getCategoryColor(category?: Category): string {
  return category?.color || '#6B7280';
}

export function getCategoryIcon(category?: Category): string {
  return category?.icon || 'folder';
}

export function getCategoryLineageIds(
  categories: Category[],
  categoryId?: CategoryId | null
): CategoryId[] {
  if (!categoryId) {
    return [];
  }

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const lineage: CategoryId[] = [];
  const visited = new Set<CategoryId>();
  const visitCategory = (currentId?: CategoryId | null) => {
    if (!currentId || visited.has(currentId)) {
      return;
    }

    visited.add(currentId);
    lineage.push(currentId);

    for (const parentCategoryId of categoriesById.get(currentId)?.parentCategoryIds ?? []) {
      visitCategory(parentCategoryId);
    }
  };

  visitCategory(categoryId);

  return lineage;
}

export function getCategoryPaths(
  categories: Category[],
  categoryId?: CategoryId | null
): Category[][] {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const buildPaths = (
    currentId?: CategoryId | null,
    stack: CategoryId[] = []
  ): Category[][] => {
    if (!currentId || stack.includes(currentId)) {
      return [];
    }

    const currentCategory = categoriesById.get(currentId);
    if (!currentCategory) {
      return [];
    }

    const parentCategoryIds = currentCategory.parentCategoryIds ?? [];
    if (parentCategoryIds.length === 0) {
      return [[currentCategory]];
    }

    const parentPaths = parentCategoryIds.flatMap((parentCategoryId) =>
      buildPaths(parentCategoryId, [...stack, currentId])
    );

    if (parentPaths.length === 0) {
      return [[currentCategory]];
    }

    return parentPaths.map((path) => [...path, currentCategory]);
  };

  const seen = new Set<string>();
  return buildPaths(categoryId).filter((path) => {
    const key = path.map((category) => category.id).join('>');
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function getCategoryPath(categories: Category[], categoryId?: CategoryId | null): Category[] {
  return getCategoryPaths(categories, categoryId)[0] ?? [];
}

export function getCategoryPathLabels(
  categories: Category[],
  categoryId?: CategoryId | null
): string[] {
  return getCategoryPaths(categories, categoryId)
    .map((path) => path.map((category) => category.name).join(' / '))
    .filter((label, index, labels) => labels.indexOf(label) === index);
}

export function getCategoryPathLabel(
  categories: Category[],
  categoryId?: CategoryId | null
): string {
  return getCategoryPathLabels(categories, categoryId).join(' • ');
}

export function getCategoryParentLabels(
  categories: Category[],
  categoryId?: CategoryId | null
): string[] {
  if (!categoryId) {
    return [];
  }

  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  return (categoriesById.get(categoryId)?.parentCategoryIds ?? [])
    .map((parentCategoryId) => getCategoryPathLabel(categories, parentCategoryId))
    .filter((label, index, labels) => label.length > 0 && labels.indexOf(label) === index);
}

export function getCategoryDescendantIds(
  categories: Category[],
  categoryId?: CategoryId | null
): CategoryId[] {
  if (!categoryId) {
    return [];
  }

  return categories
    .filter((category) => getCategoryLineageIds(categories, category.id).includes(categoryId))
    .map((category) => category.id);
}

export function isCategoryWithinBranch(
  categories: Category[],
  categoryId?: CategoryId | null,
  branchId?: CategoryId | null
): boolean {
  if (!categoryId || !branchId) {
    return false;
  }

  return getCategoryLineageIds(categories, categoryId).includes(branchId);
}

export function getProjectCategoryPathLabel(
  categories: Category[],
  project?: Pick<Project, 'categoryId'>
): string {
  return getCategoryPathLabel(categories, project?.categoryId);
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function calculateDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

export function validateHourlyRate(hourlyRate?: number | null): boolean {
  return typeof hourlyRate === 'number' && Number.isFinite(hourlyRate) && hourlyRate >= 0;
}

export function normalizeCurrency(currency?: string | null): string {
  const normalized = currency?.trim().toUpperCase();
  return normalized && normalized.length > 0 ? normalized : DEFAULT_CURRENCY;
}

export function formatCurrency(amount: number, currency?: string | null): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: normalizeCurrency(currency),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function resolveTimeBlockHourlyRate(
  block: Pick<TimeBlock, 'hourlyRate'>,
  category?: Pick<Category, 'hourlyRate'>
): number | null {
  if (validateHourlyRate(block.hourlyRate)) {
    return block.hourlyRate ?? null;
  }

  if (validateHourlyRate(category?.hourlyRate)) {
    return category?.hourlyRate ?? null;
  }

  return null;
}

export function resolveTimeBlockCurrency(
  block: Pick<TimeBlock, 'currency' | 'hourlyRate'>,
  category?: Pick<Category, 'currency' | 'hourlyRate'>
): string {
  if (validateHourlyRate(block.hourlyRate)) {
    return normalizeCurrency(block.currency);
  }

  if (validateHourlyRate(category?.hourlyRate)) {
    return normalizeCurrency(category?.currency);
  }

  return normalizeCurrency(block.currency ?? category?.currency);
}

export function isTaskCalendarBlock(block: TimeBlock): boolean {
  return Boolean(block.taskId);
}

export function isNestedTimeBlock(block: Pick<TimeBlock, 'parentBlockId'>): boolean {
  return Boolean(block.parentBlockId);
}

export function isTopLevelTimeBlock(block: Pick<TimeBlock, 'parentBlockId'>): boolean {
  return !isNestedTimeBlock(block);
}

export function getChildTimeBlocks(
  blocks: TimeBlock[],
  parentBlockId: TimeBlock['id']
): TimeBlock[] {
  return blocks
    .filter((block) => block.parentBlockId === parentBlockId)
    .sort((left, right) => left.start.getTime() - right.start.getTime());
}

export function isProjectBoundaryBlock(
  block: Pick<TimeBlock, 'projectId' | 'projectBoundaryType'>,
  projectId?: ProjectId | null,
  boundaryType?: ProjectBoundaryType | null
): boolean {
  if (!block.projectId || !block.projectBoundaryType) {
    return false;
  }

  if (projectId && block.projectId !== projectId) {
    return false;
  }

  if (boundaryType && block.projectBoundaryType !== boundaryType) {
    return false;
  }

  return true;
}

export function getCalendarItemLabel(
  block: TimeBlock
): 'Task block' | 'Project marker' | 'Calendar event' {
  if (isProjectBoundaryBlock(block)) {
    return 'Project marker';
  }

  return isTaskCalendarBlock(block) ? 'Task block' : 'Calendar event';
}

export function normalizeTimeBlockSource(
  block: Pick<TimeBlock, 'taskId' | 'source'>
): TimeBlock['source'] {
  if (block.source === 'google-calendar' || block.source === 'pomodoro') {
    return block.source;
  }

  return block.taskId ? 'task' : 'manual';
}

export function isCompletedCalendarEvent(block: TimeBlock, now = new Date()): boolean {
  return !block.taskId && block.status !== 'cancelled' && block.end.getTime() <= now.getTime();
}

export function getTimeBlockPlannedMinutes(block: TimeBlock, now = new Date()): number {
  if (isCompletedCalendarEvent(block, now)) {
    return 0;
  }

  return Math.max(calculateDurationMinutes(block.start, block.end), 1);
}

export function getTimeBlockScheduledMinutes(block: TimeBlock, now = new Date()): number {
  return getTimeBlockPlannedMinutes(block, now);
}

export function getTimeBlockActualMinutes(block: TimeBlock, now = new Date()): number {
  if (!isCompletedCalendarEvent(block, now)) {
    return block.actualMinutes;
  }

  return Math.max(block.actualMinutes, calculateDurationMinutes(block.start, block.end), 1);
}

export function getTimeBlockDurationMinutes(block: TimeBlock, now = new Date()): number {
  const actualMinutes = getTimeBlockActualMinutes(block, now);
  if (actualMinutes > 0) {
    return actualMinutes;
  }

  return Math.max(calculateDurationMinutes(block.start, block.end), 1);
}

export function calculateTimeBlockEarnings(
  block: Pick<TimeBlock, 'actualMinutes' | 'start' | 'end' | 'hourlyRate' | 'currency'>,
  category?: Pick<Category, 'hourlyRate' | 'currency'>
): number | null {
  const hourlyRate = resolveTimeBlockHourlyRate(block, category);
  if (hourlyRate === null) {
    return null;
  }

  const durationMinutes =
    typeof block.actualMinutes === 'number' && block.actualMinutes > 0
      ? block.actualMinutes
      : Math.max(calculateDurationMinutes(block.start, block.end), 1);
  return Number(((durationMinutes / 60) * hourlyRate).toFixed(2));
}

export function sumCurrencyAmounts(amounts: CurrencyAmount[]): CurrencyAmount[] {
  const totals = new Map<string, number>();

  amounts.forEach(({ amount, currency }) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const normalizedCurrency = normalizeCurrency(currency);
    totals.set(normalizedCurrency, (totals.get(normalizedCurrency) ?? 0) + amount);
  });

  return [...totals.entries()]
    .map(([currency, amount]) => ({
      currency,
      amount: Number(amount.toFixed(2)),
    }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
}

export function formatCurrencyBreakdown(amounts: CurrencyAmount[]): string {
  const totals = sumCurrencyAmounts(amounts);

  if (totals.length === 0) {
    return '$0.00';
  }

  return totals.map(({ amount, currency }) => formatCurrency(amount, currency)).join(' · ');
}

export function formatRecurrenceSummary(recurrence?: TimeBlockRecurrence): string | null {
  if (!recurrence) {
    return null;
  }

  const daysLabel = recurrence.daysOfWeek.map((day) => WEEKDAY_LABELS[day]).join(', ');

  if (recurrence.endType === 'onDate' && recurrence.until) {
    return `Repeats ${daysLabel} until ${format(recurrence.until, 'MMM d, yyyy')}`;
  }

  if (recurrence.endType === 'afterOccurrences' && recurrence.count) {
    return `Repeats ${daysLabel} for ${recurrence.count} events`;
  }

  return `Repeats ${daysLabel}`;
}

export function expandRecurringTimeBlockSeries(block: TimeBlock): TimeBlock[] {
  if (!block.recurrence) {
    return [block];
  }

  const { recurrence } = block;
  const occurrences: TimeBlock[] = [];
  const selectedDays = [...recurrence.daysOfWeek].sort((left, right) => left - right);
  const durationMinutes = Math.max(calculateDurationMinutes(block.start, block.end), 1);
  const seriesStart = startOfDay(block.start);
  const until = recurrence.until ? endOfDay(recurrence.until) : undefined;
  const excludedDayTimestamps = new Set(
    (recurrence.exclusionDates ?? []).map((date) => startOfDay(date).getTime())
  );
  let cursor = seriesStart;
  let generatedCount = 0;
  let safetyCounter = 0;

  while (safetyCounter < 730) {
    const matchesDay = selectedDays.includes(cursor.getDay() as TimeBlockRecurrence['daysOfWeek'][number]);
    const isOnOrAfterStart = cursor.getTime() >= seriesStart.getTime();
    const isWithinEndRange = until ? !isAfter(cursor, until) : true;
    const isExcluded = excludedDayTimestamps.has(startOfDay(cursor).getTime());

    if (matchesDay && isOnOrAfterStart && isWithinEndRange && !isExcluded) {
      const occurrenceStart = new Date(cursor);
      occurrenceStart.setHours(
        block.start.getHours(),
        block.start.getMinutes(),
        block.start.getSeconds(),
        block.start.getMilliseconds()
      );

      if (occurrenceStart.getTime() >= block.start.getTime()) {
        const occurrenceEnd = add(occurrenceStart, { minutes: durationMinutes });
        occurrences.push({
          ...block,
          id:
            generatedCount === 0
              ? block.id
              : (`${block.id}-occurrence-${generatedCount}` as TimeBlock['id']),
          start: occurrenceStart,
          end: occurrenceEnd,
          recurrenceIndex: generatedCount,
        });
        generatedCount += 1;

        if (
          recurrence.endType === 'afterOccurrences' &&
          recurrence.count &&
          generatedCount >= recurrence.count
        ) {
          break;
        }
      }
    }

    cursor = addDays(cursor, 1);
    safetyCounter += 1;

    if (recurrence.endType === 'onDate' && until && isAfter(cursor, until)) {
      break;
    }
  }

  return occurrences.length > 0 ? occurrences : [block];
}

function normalizeExclusionDates(dates: Date[]) {
  const deduped = new Map<number, Date>();

  dates.forEach((date) => {
    const normalizedDate = startOfDay(date);
    deduped.set(normalizedDate.getTime(), normalizedDate);
  });

  return [...deduped.values()].sort((left, right) => left.getTime() - right.getTime());
}

function getTimeBlockSeries(blocks: TimeBlock[], targetBlock: TimeBlock) {
  const seriesId = targetBlock.recurrence?.seriesId;

  if (!seriesId) {
    return [targetBlock];
  }

  return blocks
    .filter((block) => block.recurrence?.seriesId === seriesId)
    .sort((left, right) => {
      if (
        typeof left.recurrenceIndex === 'number' &&
        typeof right.recurrenceIndex === 'number' &&
        left.recurrenceIndex !== right.recurrenceIndex
      ) {
        return left.recurrenceIndex - right.recurrenceIndex;
      }

      return left.start.getTime() - right.start.getTime();
    });
}

function createScopedSeriesId() {
  return `series-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function getSeriesWeekdays(blocks: TimeBlock[]) {
  return [...new Set(
    blocks.map(
      (block) => startOfDay(block.start).getDay() as TimeBlockRecurrence['daysOfWeek'][number]
    )
  )].sort((left, right) => left - right);
}

function buildSeriesRecurrence(blocks: TimeBlock[], recurrence: TimeBlock['recurrence'] | undefined, seriesId: string) {
  if (!recurrence || blocks.length === 0) {
    return recurrence;
  }

  return {
    ...recurrence,
    daysOfWeek: getSeriesWeekdays(blocks),
    endType: 'afterOccurrences' as const,
    count: blocks.length,
    until: undefined,
    exclusionDates: undefined,
    seriesId,
  };
}

export function getTimeBlockSeriesTargets(
  blocks: TimeBlock[],
  targetBlock: TimeBlock,
  scope: RecurringSeriesScope = 'single'
): TimeBlock[] {
  if (scope === 'single' || !targetBlock.recurrence?.seriesId) {
    return [targetBlock];
  }

  const seriesBlocks = getTimeBlockSeries(blocks, targetBlock);

  if (scope === 'all') {
    return seriesBlocks;
  }

  const targetRecurrenceIndex = targetBlock.recurrenceIndex;

  if (typeof targetRecurrenceIndex === 'number') {
    return seriesBlocks.filter((block) => {
      if (typeof block.recurrenceIndex === 'number') {
        return block.recurrenceIndex >= targetRecurrenceIndex;
      }

      return block.start.getTime() >= targetBlock.start.getTime();
    });
  }

  return seriesBlocks.filter((block) => block.start.getTime() >= targetBlock.start.getTime());
}

export function getTimeBlockDeleteTargets(
  blocks: TimeBlock[],
  targetBlock: TimeBlock,
  scope: RecurringDeleteScope = 'single'
): TimeBlock[] {
  return getTimeBlockSeriesTargets(blocks, targetBlock, scope);
}

export function applyTimeBlockDeleteScope(
  blocks: TimeBlock[],
  targetBlock: TimeBlock,
  scope: RecurringDeleteScope = 'single'
) {
  const deletedBlocks = getTimeBlockDeleteTargets(blocks, targetBlock, scope);
  const deletedIds = new Set(deletedBlocks.map((block) => block.id));
  const seriesId = targetBlock.recurrence?.seriesId;
  let remainingBlocks = blocks.filter((block) => !deletedIds.has(block.id));

  if (!seriesId || scope === 'all') {
    return {
      remainingBlocks,
      deletedBlocks,
    };
  }

  const remainingSeriesBlocks = remainingBlocks.filter((block) => block.recurrence?.seriesId === seriesId);
  if (remainingSeriesBlocks.length === 0) {
    return {
      remainingBlocks,
      deletedBlocks,
    };
  }

  if (scope === 'single') {
    const deletedDate = startOfDay(targetBlock.start);

    remainingBlocks = remainingBlocks.map((block) => {
      if (block.recurrence?.seriesId !== seriesId) {
        return block;
      }

      return {
        ...block,
        recurrence: {
          ...block.recurrence,
          exclusionDates: normalizeExclusionDates([
            ...(block.recurrence.exclusionDates ?? []),
            deletedDate,
          ]),
          count:
            block.recurrence.endType === 'afterOccurrences'
              ? remainingSeriesBlocks.length
              : block.recurrence.count,
        },
      };
    });

    return {
      remainingBlocks,
      deletedBlocks,
    };
  }

  const lastRemainingTimestamp = Math.max(
    ...remainingSeriesBlocks.map((block) => startOfDay(block.start).getTime())
  );

  remainingBlocks = remainingBlocks.map((block) => {
    if (block.recurrence?.seriesId !== seriesId) {
      return block;
    }

    return {
      ...block,
      recurrence: {
        ...block.recurrence,
        endType: 'afterOccurrences',
        count: remainingSeriesBlocks.length,
        until: undefined,
        exclusionDates: normalizeExclusionDates(
          (block.recurrence.exclusionDates ?? []).filter(
            (date) => startOfDay(date).getTime() <= lastRemainingTimestamp
          )
        ),
      },
    };
  });

  return {
    remainingBlocks,
    deletedBlocks,
  };
}

export function applyTimeBlockEditScope(
  blocks: TimeBlock[],
  originalBlock: TimeBlock,
  editedBlock: TimeBlock,
  scope: RecurringEditScope = 'single'
) {
  if (scope === 'single' || !originalBlock.recurrence?.seriesId) {
    return [editedBlock];
  }

  const seriesBlocks = getTimeBlockSeries(blocks, originalBlock);
  const targetBlocks = getTimeBlockSeriesTargets(blocks, originalBlock, scope);
  const targetIds = new Set(targetBlocks.map((block) => block.id));
  const unaffectedBlocks = seriesBlocks.filter((block) => !targetIds.has(block.id));
  const startDeltaMs = editedBlock.start.getTime() - originalBlock.start.getTime();
  const endDeltaMs = editedBlock.end.getTime() - originalBlock.end.getTime();
  const actualMinutesChanged = editedBlock.actualMinutes !== originalBlock.actualMinutes;
  const targetSeriesId =
    scope === 'following'
      ? createScopedSeriesId()
      : (originalBlock.recurrence?.seriesId ?? editedBlock.recurrence?.seriesId ?? createScopedSeriesId());

  const nextTargetBlocksBase = targetBlocks.map((block) => ({
    ...block,
    title: editedBlock.title,
    description: editedBlock.description,
    categoryId: editedBlock.categoryId,
    tagIds: [...editedBlock.tagIds],
    taskId: editedBlock.taskId,
    start: new Date(block.start.getTime() + startDeltaMs),
    end: new Date(block.end.getTime() + endDeltaMs),
    actualMinutes: actualMinutesChanged ? editedBlock.actualMinutes : block.actualMinutes,
    hourlyRate: editedBlock.hourlyRate,
    currency: editedBlock.currency,
    source: normalizeTimeBlockSource({
      taskId: editedBlock.taskId,
      source: editedBlock.source ?? block.source,
    }),
    status: block.status,
    recurrence: block.recurrence,
  }));
  const nextTargetRecurrence = buildSeriesRecurrence(
    nextTargetBlocksBase,
    editedBlock.recurrence ?? originalBlock.recurrence,
    targetSeriesId
  );
  const nextTargetBlocks = nextTargetBlocksBase.map((block, index) => ({
    ...block,
    recurrence: nextTargetRecurrence,
    recurrenceIndex: index,
  }));

  if (scope !== 'following') {
    return nextTargetBlocks;
  }

  const preservedSeriesId = originalBlock.recurrence.seriesId;
  const nextUnaffectedRecurrence = buildSeriesRecurrence(
    unaffectedBlocks,
    originalBlock.recurrence,
    preservedSeriesId
  );
  const nextUnaffectedBlocks = unaffectedBlocks.map((block, index) => ({
    ...block,
    recurrence: nextUnaffectedRecurrence,
    recurrenceIndex: index,
  }));

  return [...nextUnaffectedBlocks, ...nextTargetBlocks];
}

export function getTaskStatusColor(status: string): string {
  const colors = {
    inbox: 'bg-gray-100 text-gray-800',
    next: 'bg-blue-100 text-blue-800',
    doing: 'bg-purple-100 text-purple-800',
    waiting: 'bg-yellow-100 text-yellow-800',
    done: 'bg-green-100 text-green-800',
  };
  return (colors as Record<string, string>)[status] || 'bg-gray-100 text-gray-800';
}

export function getPriorityColor(priority: string): string {
  const colors = {
    low: 'text-gray-500',
    medium: 'text-yellow-500',
    high: 'text-red-500',
  };
  return (colors as Record<string, string>)[priority] || 'text-gray-500';
}

export function getHoursInDayForCategory(
  categoryId: CategoryId,
  blocks: TimeBlock[],
  date: Date
): number {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const dayBlocks = blocks.filter(
    (b) =>
      b.categoryId === categoryId &&
      b.start >= dayStart &&
      b.start <= dayEnd &&
      b.status !== 'cancelled'
  );

  return dayBlocks.reduce((acc, block) => acc + getTimeBlockScheduledMinutes(block), 0) / 60;
}

export function getCompletionPercentage(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((t) => t.status === 'done').length;
  return Math.round((completed / tasks.length) * 100);
}

export function getDayTimeSlots(date: Date): Date[] {
  const start = startOfDay(date);
  const end = endOfDay(date);
  // Create slots for every 30 minutes
  const slots: Date[] = [];
  let current = new Date(start);
  while (current <= end) {
    slots.push(new Date(current));
    current = new Date(current.getTime() + 30 * 60000);
  }
  return slots;
}

export function groupTasksByStatus(tasks: Task[]): Record<string, Task[]> {
  return {
    inbox: tasks.filter((t) => t.status === 'inbox'),
    next: tasks.filter((t) => t.status === 'next'),
    doing: tasks.filter((t) => t.status === 'doing'),
    waiting: tasks.filter((t) => t.status === 'waiting'),
    done: tasks.filter((t) => t.status === 'done'),
  };
}

export function isTimeBlockToday(block: TimeBlock): boolean {
  const today = startOfDay(new Date());
  const blockDay = startOfDay(block.start);
  return today.getTime() === blockDay.getTime();
}

export function getTodayLabel(): string {
  const today = new Date();
  return format(today, 'EEEE, MMMM d');
}

export function getWeekProgress(referenceDate: Date, now = new Date()): TimeProgressSnapshot {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: WEEK_STARTS_ON });
  const weekEndExclusive = add(weekStart, { days: 7 });
  const totalMinutes = WEEK_TOTAL_MINUTES;

  const totalMilliseconds = weekEndExclusive.getTime() - weekStart.getTime();
  const elapsedMilliseconds = Math.min(
    Math.max(now.getTime() - weekStart.getTime(), 0),
    totalMilliseconds
  );
  const elapsedMinutes = Math.round(elapsedMilliseconds / (1000 * 60));
  const remainingMinutes = Math.max(totalMinutes - elapsedMinutes, 0);
  const percentComplete = Number(((elapsedMinutes / totalMinutes) * 100).toFixed(1));

  let state: TimeProgressSnapshot['state'] = 'current';
  if (now < weekStart) {
    state = 'future';
  } else if (now >= weekEndExclusive) {
    state = 'past';
  }

  return {
    start: weekStart,
    end: weekEnd,
    totalMinutes,
    elapsedMinutes,
    remainingMinutes,
    percentComplete,
    state,
    scope: 'week',
  };
}

export function getDayProgress(referenceDate: Date, now = new Date()): TimeProgressSnapshot {
  const dayStart = startOfDay(referenceDate);
  const dayEnd = endOfDay(referenceDate);
  const dayEndExclusive = add(dayStart, { days: 1 });
  const totalMinutes = DAY_TOTAL_MINUTES;

  const totalMilliseconds = dayEndExclusive.getTime() - dayStart.getTime();
  const elapsedMilliseconds = Math.min(
    Math.max(now.getTime() - dayStart.getTime(), 0),
    totalMilliseconds
  );
  const elapsedMinutes = Math.round(elapsedMilliseconds / (1000 * 60));
  const remainingMinutes = Math.max(totalMinutes - elapsedMinutes, 0);
  const percentComplete = Number(((elapsedMinutes / totalMinutes) * 100).toFixed(1));

  let state: TimeProgressSnapshot['state'] = 'current';
  if (now < dayStart) {
    state = 'future';
  } else if (now >= dayEndExclusive) {
    state = 'past';
  }

  return {
    start: dayStart,
    end: dayEnd,
    totalMinutes,
    elapsedMinutes,
    remainingMinutes,
    percentComplete,
    state,
    scope: 'day',
  };
}
