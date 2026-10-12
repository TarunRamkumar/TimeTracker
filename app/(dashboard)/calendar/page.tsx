'use client';

import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import {
  add,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  setHours,
  startOfDay,
  startOfMonth,
  startOfWeek,
  sub,
} from 'date-fns';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Clock3,
  Copy,
  Layers3,
  Pencil,
  Plus,
  Target,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { CategoryForm, TimeBlockForm } from '@/components/forms';
import { useAppData } from '@/components/providers/AppDataProvider';
import { useCategories } from '@/components/providers/CategoriesProvider';
import { WeekProgressCard } from '@/components/shared/WeekProgressCard';
import { PageShell } from '@/components/layout/PageShell';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
} from '@/components/ui';
import { useCategoryForm, useTimeBlockForm } from '@/hooks/useForms';
import { DEFAULT_CATEGORIES } from '@/lib/domain/constants';
import {
  buildCategoryFromFormValues,
  buildTimeBlockFromFormValues,
  buildTimeBlockSeriesFromFormValues,
} from '@/lib/forms/mappers';
import type { CategoryFormValues, TimeBlockFormValues } from '@/lib/forms/schemas';
import {
  calculateTimeBlockEarnings,
  applyTimeBlockEditScope,
  calculateDurationMinutes,
  formatCurrencyBreakdown,
  formatMinutes,
  getChildTimeBlocks,
  getCategoryLineageIds,
  getCategoryPathLabel,
  isProjectBoundaryBlock,
  isTopLevelTimeBlock,
  getTimeBlockActualMinutes,
  getTimeBlockDurationMinutes,
  getTimeBlockScheduledMinutes,
  resolveTimeBlockCurrency,
  sumCurrencyAmounts,
} from '@/lib/domain/helpers';
import type {
  Category,
  RecurringDeleteScope,
  RecurringEditScope,
  Task,
  TimeBlock,
  TimeBlockId,
} from '@/lib/domain/types';

const WEEK_STARTS_ON = 1 as const;
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;
const HOUR_ROW_HEIGHT = 68;
const MIN_EVENT_HEIGHT = 52;
const PLANNER_TIME_RAIL_WIDTH = 64;
const PLANNER_EVENT_SIDE_PADDING = 6;
const PLANNER_EVENT_OVERLAP_PEEK = 12;
const PLANNER_EVENT_GAP = 3;
const TIME_SLOTS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, index) => DAY_START_HOUR + index
);

interface QuickAction {
  id: 'new-block' | 'timebox-task' | 'start-focus';
  title: string;
  description: string;
  icon: LucideIcon;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'new-block',
    title: 'New event',
    description: 'Drop a focused work session into the calendar.',
    icon: Plus,
  },
  {
    id: 'timebox-task',
    title: 'Timebox a task',
    description: 'Convert a to-do into a real calendar commitment.',
    icon: Target,
  },
  {
    id: 'start-focus',
    title: 'Start focus timer',
    description: 'Kick off a tracked session from the calendar surface.',
    icon: Timer,
  },
];

type CategorySummary = {
  category: Category;
  scheduledMinutes: number;
  actualMinutes: number;
  blockCount: number;
  totalMinutes: number;
  earningsLabel?: string;
};

type CalendarViewMode = 'day' | 'week' | 'month';

type CopiedCalendarEvent = {
  title: string;
  description: string;
  categoryId: Category['id'];
  tagIds: TimeBlock['tagIds'];
  durationMinutes: number;
  templateStart: Date;
  hourlyRate?: number | null;
  currency?: string | null;
};

type CalendarContextMenuState =
  | {
      x: number;
      y: number;
      kind: 'event';
      block: TimeBlock;
    }
  | {
      x: number;
      y: number;
      kind: 'paste-target';
      start: Date;
      preserveCopiedTime: boolean;
    };

type CalendarContextMenuInput =
  | {
      kind: 'event';
      block: TimeBlock;
    }
  | {
      kind: 'paste-target';
      start: Date;
      preserveCopiedTime: boolean;
    };

type CalendarDraftBlock = {
  title: string;
  description: string;
  categoryId: Category['id'];
  tagIds: TimeBlock['tagIds'];
  taskId?: Task['id'];
  start: Date;
  end: Date;
  actualMinutes: number;
  source: TimeBlock['source'];
  status: TimeBlock['status'];
};

type DraftInteractionState =
  | {
      mode: 'move';
      pointerId: number;
      minuteGrabOffset: number;
      durationMinutes: number;
    }
  | {
      mode: 'resize-start' | 'resize-end';
      pointerId: number;
    };

type SavedBlockInteractionState =
  | {
      mode: 'move';
      pointerId: number;
      blockId: TimeBlock['id'];
      minuteGrabOffset: number;
      durationMinutes: number;
    }
  | {
      mode: 'resize-start' | 'resize-end';
      pointerId: number;
      blockId: TimeBlock['id'];
    };

type SavedBlockInteractionPreview = {
  blockId: TimeBlock['id'];
  start: Date;
  end: Date;
};

const GRID_TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const SNAP_MINUTES = 5;
const MIN_BLOCK_MINUTES = 5;

type PendingRecurringChange =
  | {
      kind: 'move';
      block: TimeBlock;
      start: Date;
      end: Date;
    }
  | {
      kind: 'resize';
      block: TimeBlock;
      start: Date;
      end: Date;
    };

type CalendarEventLayout = {
  top: number;
  height: number;
  left: number;
  width: number;
  zIndex: number;
  columns: number;
  span: number;
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [draftBlock, setDraftBlock] = useState<CalendarDraftBlock | null>(null);
  const [copiedBlock, setCopiedBlock] = useState<CopiedCalendarEvent | null>(null);
  const [contextMenu, setContextMenu] = useState<CalendarContextMenuState | null>(null);
  const [deleteTargetBlock, setDeleteTargetBlock] = useState<TimeBlock | null>(null);
  const [pendingRecurringChange, setPendingRecurringChange] = useState<PendingRecurringChange | null>(null);
  const timeBlockForm = useTimeBlockForm<TimeBlock>();
  const categoryForm = useCategoryForm<Category>();
  const { categories, setCategories } = useCategories();
  const {
    tasks,
    timeBlocks,
    tags,
    activeTimer,
    isTimerRunning,
    startTimer,
    stopTimer,
    resumeTimer,
    completeTask,
    upsertTimeBlock,
    upsertTimeBlocks,
    deleteTimeBlock,
    addTimeBlockNote,
  } = useAppData();

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenu = () => setContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
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
  }, [contextMenu]);

  const {
    rangeStart,
    rangeEnd,
    gridStart,
    gridEnd,
    heroBadge,
    metricLabel,
    focusTitle,
    resetLabel,
    rangeLabel,
  } = getCalendarViewConfig(currentDate, viewMode);
  const visibleDays = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const monthGridDays =
    viewMode === 'month' && gridStart && gridEnd
      ? eachDayOfInterval({ start: gridStart, end: gridEnd })
      : visibleDays;

  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const getCompensationDefaultsForCategory = (categoryId: string) => {
    const category = categoryMap.get(categoryId as Category['id']);

    return {
      hourlyRate: category?.hourlyRate ?? null,
      currency: category?.currency ?? null,
    };
  };
  const visibleBlocks = timeBlocks
    .filter((block) => block.start >= rangeStart && block.start <= rangeEnd)
    .sort((left, right) => left.start.getTime() - right.start.getTime());
  const visibleBlockIds = new Set(visibleBlocks.map((block) => block.id));
  const summaryBlocks = visibleBlocks.filter(
    (block) => !block.parentBlockId || !visibleBlockIds.has(block.parentBlockId)
  );

  const visibleTasks = tasks.filter(
    (task) =>
      task.status !== 'done' &&
      task.dueDate &&
      task.dueDate >= rangeStart &&
      task.dueDate <= rangeEnd
  ).sort((left, right) => {
    const leftTime = left.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightTime = right.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  });

  const scheduledMinutes = summaryBlocks.reduce(
    (sum, block) => sum + getTimeBlockScheduledMinutes(block),
    0
  );
  const trackedMinutes = summaryBlocks.reduce(
    (sum, block) => sum + getTimeBlockActualMinutes(block),
    0
  );
  const earningsByCurrency = sumCurrencyAmounts(
    summaryBlocks.flatMap((block) => {
      const category = categoryMap.get(block.categoryId);
      const earnings = calculateTimeBlockEarnings(block, category);
      if (earnings === null || earnings <= 0) {
        return [];
      }

      return [
        {
          amount: earnings,
          currency: resolveTimeBlockCurrency(block, category),
        },
      ];
    })
  );
  const earningsLabel = earningsByCurrency.length > 0 ? formatCurrencyBreakdown(earningsByCurrency) : 'No paid time';
  const executionRate =
    scheduledMinutes === 0 ? 0 : Math.round((trackedMinutes / scheduledMinutes) * 100);
  const varianceMinutes = trackedMinutes - scheduledMinutes;
  const linkedBlockCount = visibleBlocks.filter((block) => block.taskId).length;
  const syncedBlockCount = visibleBlocks.filter((block) => block.googleEventId).length;

  const today = new Date();
  const todaysBlocks = summaryBlocks.filter((block) => isSameDay(block.start, today));
  const todaysScheduledMinutes = todaysBlocks.reduce(
    (sum, block) => sum + getTimeBlockScheduledMinutes(block),
    0
  );
  const todaysTrackedMinutes = todaysBlocks.reduce(
    (sum, block) => sum + getTimeBlockActualMinutes(block),
    0
  );

  const categorySummaries = categories.map((category) => {
    const blocks = summaryBlocks.filter((block) =>
      getCategoryLineageIds(categories, block.categoryId).includes(category.id)
    );
    const scheduledMinutes = blocks.reduce(
      (sum, block) => sum + getTimeBlockScheduledMinutes(block),
      0
    );
    const actualMinutes = blocks.reduce(
      (sum, block) => sum + getTimeBlockActualMinutes(block),
      0
    );
    const categoryEarnings = sumCurrencyAmounts(
      blocks.flatMap((block) => {
        const blockCategory = categoryMap.get(block.categoryId);
        const earnings = calculateTimeBlockEarnings(block, blockCategory);
        if (earnings === null || earnings <= 0) {
          return [];
        }

        return [
          {
            amount: earnings,
            currency: resolveTimeBlockCurrency(block, blockCategory),
          },
        ];
      })
    );

    return {
      category,
      label: getCategoryPathLabel(categories, category.id) || category.name,
      scheduledMinutes,
      actualMinutes,
      blockCount: blocks.length,
      totalMinutes: scheduledMinutes + actualMinutes,
      earningsLabel:
        categoryEarnings.length > 0 ? formatCurrencyBreakdown(categoryEarnings) : undefined,
    };
  })
    .filter((summary) => summary.blockCount > 0)
    .sort((left, right) => right.totalMinutes - left.totalMinutes);

  const topCategory = categorySummaries[0];
  const plannerHeight = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_ROW_HEIGHT;

  const goToPreviousPeriod = () => {
    setDraftBlock(null);
    setCurrentDate((value) => {
      if (viewMode === 'day') {
        return sub(value, { days: 1 });
      }

      if (viewMode === 'month') {
        return sub(value, { months: 1 });
      }

      return sub(value, { weeks: 1 });
    });
  };

  const goToNextPeriod = () => {
    setDraftBlock(null);
    setCurrentDate((value) => {
      if (viewMode === 'day') {
        return add(value, { days: 1 });
      }

      if (viewMode === 'month') {
        return add(value, { months: 1 });
      }

      return add(value, { weeks: 1 });
    });
  };

  const handleViewModeChange = (mode: CalendarViewMode) => {
    setDraftBlock(null);
    setViewMode(mode);
  };

  const openCreateBlock = () => {
    timeBlockForm.openCreate();
  };

  const openFocusSession = () => {
    const defaultCategoryId = categories[0]?.id ?? DEFAULT_CATEGORIES[0].id;
    const suggestedStart = roundUpToQuarterHour(new Date());

    timeBlockForm.openCreate({
      title: 'Focus session',
      description: 'Manual focus event started from the calendar.',
      categoryId: defaultCategoryId,
      start: suggestedStart,
      end: add(suggestedStart, { minutes: 25 }),
      plannedMinutes: 25,
      actualMinutes: 0,
      source: 'pomodoro',
      status: 'in-progress',
    });
  };

  const openTimeboxTask = () => {
    const task = visibleTasks.find((item) => !item.scheduledStart || !item.scheduledEnd);
    if (!task) {
      timeBlockForm.openCreate();
      return;
    }

    const suggestedStart = add(startOfDay(task.dueDate ?? currentDate), { hours: 9 });
    const suggestedDuration = task.estimatedMinutes ?? 60;

    timeBlockForm.openCreate({
      title: task.title,
      description: task.description,
      categoryId: task.categoryId,
      taskId: task.id,
      tagIds: task.tagIds,
      start: suggestedStart,
      end: add(suggestedStart, { minutes: suggestedDuration }),
      plannedMinutes: suggestedDuration,
      actualMinutes: 0,
      source: 'task',
      status: 'scheduled',
    });
  };

  const handleTimeBlockSubmit = async (
    data: TimeBlockFormValues,
    scope: RecurringEditScope = 'single'
  ) => {
    const createNestedTaskBlock = shouldCreateNestedTaskBlock(data, timeBlockForm.initialData);
    const parentFormValues = createNestedTaskBlock
      ? {
          ...data,
          taskId: undefined,
          source:
            data.source === 'task'
              ? ('manual' as const)
              : data.source,
        }
      : data;
    const nextBlocks = buildTimeBlockSeriesFromFormValues(parentFormValues, timeBlockForm.initialData, {
      compensationDefaults: getCompensationDefaultsForCategory(data.categoryId),
    });
    const previousBlock = timeBlockForm.initialData?.id
      ? timeBlocks.find((block) => block.id === timeBlockForm.initialData?.id)
      : undefined;

    if (previousBlock?.recurrence?.seriesId && scope !== 'single' && nextBlocks.length === 1) {
      const editedBlock = nextBlocks[0];
      const scopedBlocks = applyTimeBlockEditScope(timeBlocks, previousBlock, editedBlock, scope);
      const nextChildBlocks = createNestedTaskBlock
        ? buildChildTaskBlocksForParents(
            scopedBlocks,
            data.taskId,
            tasks,
            [...timeBlocks, ...scopedBlocks],
            getCompensationDefaultsForCategory
          )
        : [];

      upsertTimeBlocks([...scopedBlocks, ...nextChildBlocks], {
        preservePlannedMinutes: true,
      });
      return;
    }

    const nextChildBlocks = createNestedTaskBlock
      ? buildChildTaskBlocksForParents(
          nextBlocks,
          data.taskId,
          tasks,
          [...timeBlocks, ...nextBlocks],
          getCompensationDefaultsForCategory
        )
      : [];

    if (nextBlocks.length === 1) {
      const nextBlock = nextBlocks[0];
      const existingBlock = timeBlocks.find((block) => block.id === nextBlock.id);
      const nextRangeMinutes = Math.max(calculateDurationMinutes(nextBlock.start, nextBlock.end), 1);
      const rangeChanged = existingBlock
        ? existingBlock.start.getTime() !== nextBlock.start.getTime() ||
          existingBlock.end.getTime() !== nextBlock.end.getTime()
        : false;
      const nextActualMinutes =
        existingBlock && nextBlock.taskId && rangeChanged && data.actualMinutes === existingBlock.actualMinutes
          ? nextRangeMinutes
          : nextBlock.actualMinutes;

      const finalizedBlock = {
        ...nextBlock,
        actualMinutes: nextActualMinutes,
      };

      if (nextChildBlocks.length > 0) {
        upsertTimeBlocks([finalizedBlock, ...nextChildBlocks], {
          preservePlannedMinutes: Boolean(existingBlock),
        });
        return;
      }

      upsertTimeBlock(finalizedBlock, {
        preservePlannedMinutes: Boolean(existingBlock),
      });
      return;
    }

    upsertTimeBlocks([...nextBlocks, ...nextChildBlocks]);
  };

  const handleTimeBlockDelete = async (scope: RecurringDeleteScope = 'single') => {
    const blockId = timeBlockForm.initialData?.id;
    if (!blockId) {
      return;
    }

    const blockToDelete = timeBlocks.find((block) => block.id === blockId);
    if (!blockToDelete) {
      return;
    }

    deleteTimeBlock(blockId, { scope });
  };

  const openContextMenu = (x: number, y: number, nextMenu: CalendarContextMenuInput) => {
    const menuWidth = 224;
    const menuHeight = nextMenu.kind === 'event' ? 108 : 64;
    const safeX =
      typeof window === 'undefined'
        ? x
        : clamp(x, 12, Math.max(window.innerWidth - menuWidth - 12, 12));
    const safeY =
      typeof window === 'undefined'
        ? y
        : clamp(y, 12, Math.max(window.innerHeight - menuHeight - 12, 12));

    if (nextMenu.kind === 'event') {
      setContextMenu({
        kind: 'event',
        block: nextMenu.block,
        x: safeX,
        y: safeY,
      });
      return;
    }

    setContextMenu({
      kind: 'paste-target',
      start: nextMenu.start,
      preserveCopiedTime: nextMenu.preserveCopiedTime,
      x: safeX,
      y: safeY,
    });
  };

  const handleBlockContextMenu = (event: ReactMouseEvent<HTMLElement>, block: TimeBlock) => {
    event.preventDefault();
    event.stopPropagation();

    if (isProjectBoundaryBlock(block)) {
      return;
    }
    setDraftBlock(null);
    openContextMenu(event.clientX, event.clientY, {
      kind: 'event',
      block,
    });
  };

  const handleGridPasteTargetContextMenu = (
    event: ReactMouseEvent<HTMLDivElement>,
    start: Date,
    preserveCopiedTime = false
  ) => {
    if (!copiedBlock) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    openContextMenu(event.clientX, event.clientY, {
      kind: 'paste-target',
      start,
      preserveCopiedTime,
    });
  };

  const handleCopyBlock = (block: TimeBlock) => {
    setCopiedBlock({
      title: block.title,
      description: block.description,
      categoryId: block.categoryId,
      tagIds: [...block.tagIds],
      durationMinutes: Math.max(calculateDurationMinutes(block.start, block.end), MIN_BLOCK_MINUTES),
      templateStart: new Date(block.start),
      hourlyRate: block.hourlyRate ?? null,
      currency: block.currency ?? null,
    });
    setContextMenu(null);
  };

  const handlePasteBlock = (start: Date, preserveCopiedTime = false) => {
    if (!copiedBlock) {
      return;
    }

    const desiredStart = new Date(start);
    if (preserveCopiedTime) {
      desiredStart.setHours(
        copiedBlock.templateStart.getHours(),
        copiedBlock.templateStart.getMinutes(),
        0,
        0
      );
    }

    const durationMinutes = Math.max(copiedBlock.durationMinutes, MIN_BLOCK_MINUTES);
    const baseDay = startOfDay(desiredStart);
    const clampedStartOffset = clampGridMinutes(getMinutesFromGridStart(desiredStart), durationMinutes);
    const nextStart = getDateForGridOffset(baseDay, clampedStartOffset);
    const nextEnd = add(nextStart, { minutes: durationMinutes });

    const nextBlock = buildTimeBlockFromFormValues({
      title: copiedBlock.title,
      description: copiedBlock.description,
      categoryId: copiedBlock.categoryId,
      tagIds: copiedBlock.tagIds,
      taskId: undefined,
      start: nextStart,
      end: nextEnd,
      plannedMinutes: durationMinutes,
      actualMinutes: 0,
      hourlyRate: copiedBlock.hourlyRate ?? undefined,
      currency: copiedBlock.currency ?? undefined,
      isRecurring: false,
      recurrenceDays: [],
      recurrenceEndType: 'onDate',
      recurrenceUntil: undefined,
      recurrenceCount: undefined,
      source: 'manual',
      status: 'scheduled',
      googleEventId: '',
      calendarId: '',
    }, undefined, {
      compensationDefaults: getCompensationDefaultsForCategory(copiedBlock.categoryId),
    });

    upsertTimeBlock(nextBlock);
    setContextMenu(null);
  };

  const handleContextDelete = (block: TimeBlock) => {
    if (isProjectBoundaryBlock(block)) {
      return;
    }

    setContextMenu(null);

    if (block.recurrence?.seriesId) {
      setDeleteTargetBlock(block);
      return;
    }

    if (window.confirm('Delete this calendar event? This cannot be undone.')) {
      deleteTimeBlock(block.id, { scope: 'single' });
    }
  };

  const handleScopedContextDelete = (scope: RecurringDeleteScope) => {
    if (!deleteTargetBlock) {
      return;
    }

    deleteTimeBlock(deleteTargetBlock.id, { scope });
    setDeleteTargetBlock(null);
  };

  const handleDraftCreate = (start: Date) => {
    const safeCategoryId = categories[0]?.id ?? DEFAULT_CATEGORIES[0].id;
    const snappedStart = snapDateToGrid(start);
    const end = ensureDraftEnd(snappedStart, add(snappedStart, { minutes: 60 }));

    setDraftBlock({
      title: 'New event',
      description: '',
      categoryId: safeCategoryId,
      tagIds: [],
      start: snappedStart,
      end,
      actualMinutes: 0,
      source: 'manual',
      status: 'scheduled',
    });
  };

  const handleDraftChange = (nextDraft: CalendarDraftBlock) => {
    const snappedStart = snapDateToGrid(nextDraft.start);

    setDraftBlock({
      ...nextDraft,
      start: snappedStart,
      end: ensureDraftEnd(snappedStart, nextDraft.end),
    });
  };

  const handleDraftCancel = () => {
    setDraftBlock(null);
  };

  const handleDraftSave = () => {
    if (!draftBlock) {
      return;
    }

    const createNestedTaskBlock = Boolean(draftBlock.taskId);
    const parentBlock = buildTimeBlockFromFormValues({
      title: draftBlock.title,
      description: draftBlock.description,
      categoryId: draftBlock.categoryId,
      tagIds: draftBlock.tagIds,
      taskId: undefined,
      start: draftBlock.start,
      end: draftBlock.end,
      plannedMinutes: calculateDurationMinutes(draftBlock.start, draftBlock.end),
      actualMinutes: draftBlock.actualMinutes,
      isRecurring: false,
      recurrenceDays: [],
      recurrenceEndType: 'onDate',
      recurrenceUntil: undefined,
      recurrenceCount: undefined,
      source: draftBlock.source,
      status: draftBlock.status,
      googleEventId: '',
      calendarId: '',
    }, undefined, {
      compensationDefaults: getCompensationDefaultsForCategory(draftBlock.categoryId),
    });

    const childBlocks = createNestedTaskBlock
      ? buildChildTaskBlocksForParents(
          [parentBlock],
          draftBlock.taskId,
          tasks,
          [...timeBlocks, parentBlock],
          getCompensationDefaultsForCategory
        )
      : [];

    if (childBlocks.length > 0) {
      upsertTimeBlocks([parentBlock, ...childBlocks]);
    } else {
      upsertTimeBlock(parentBlock);
    }

    setDraftBlock(null);
  };

  const handleDraftExpand = () => {
    if (!draftBlock) {
      return;
    }

    timeBlockForm.openCreate({
      ...draftBlock,
      plannedMinutes: calculateDurationMinutes(draftBlock.start, draftBlock.end),
    });
    setDraftBlock(null);
  };

  const handleCategorySubmit = async (data: CategoryFormValues) => {
    const nextCategory = buildCategoryFromFormValues(data, categoryForm.initialData);

    setCategories((currentCategories) => {
      const exists = currentCategories.some((category) => category.id === nextCategory.id);
      if (!exists) {
        return [...currentCategories, nextCategory];
      }

      return currentCategories.map((category) =>
        category.id === nextCategory.id ? nextCategory : category
      );
    });
  };

  const handleQuickAction = (actionId: QuickAction['id']) => {
    if (actionId === 'new-block') {
      openCreateBlock();
      return;
    }

    if (actionId === 'timebox-task') {
      openTimeboxTask();
      return;
    }

    openFocusSession();
  };

  const handleCalendarEventMove = (block: TimeBlock, start: Date, end: Date) => {
    const constrainedRange = constrainTimeBlockRangeToParent(block, start, end, timeBlocks);

    if (block.recurrence?.seriesId) {
      setPendingRecurringChange({
        kind: 'move',
        block,
        start: constrainedRange.start,
        end: constrainedRange.end,
      });
      return;
    }

    upsertTimeBlock(
      {
        ...block,
        start: constrainedRange.start,
        end: constrainedRange.end,
      },
      {
        preservePlannedMinutes: true,
      }
    );
  };

  const handleCalendarEventResize = (block: TimeBlock, start: Date, end: Date) => {
    const constrainedRange = constrainTimeBlockRangeToParent(block, start, end, timeBlocks);

    if (block.recurrence?.seriesId) {
      setPendingRecurringChange({
        kind: 'resize',
        block,
        start: constrainedRange.start,
        end: constrainedRange.end,
      });
      return;
    }

    upsertTimeBlock(
      {
        ...block,
        start: constrainedRange.start,
        end: constrainedRange.end,
        actualMinutes: Math.max(
          calculateDurationMinutes(constrainedRange.start, constrainedRange.end),
          1
        ),
      },
      {
        preservePlannedMinutes: true,
        syncActualMinutesFromRange: true,
      }
    );
  };

  const applyRecurringCalendarChange = (
    change: PendingRecurringChange,
    scope: RecurringEditScope
  ) => {
    const editedBlock: TimeBlock = {
      ...change.block,
      start: change.start,
      end: change.end,
      actualMinutes:
        change.kind === 'resize'
          ? Math.max(calculateDurationMinutes(change.start, change.end), 1)
          : change.block.actualMinutes,
    };

    if (scope === 'single') {
      upsertTimeBlock(editedBlock, {
        preservePlannedMinutes: true,
        syncActualMinutesFromRange: change.kind === 'resize',
      });
      return;
    }

    const scopedBlocks = applyTimeBlockEditScope(timeBlocks, change.block, editedBlock, scope);
    upsertTimeBlocks(scopedBlocks, {
      preservePlannedMinutes: true,
      syncActualMinutesFromRange: change.kind === 'resize',
    });
  };

  const selectedBlock = timeBlockForm.initialData?.id
    ? timeBlocks.find((block) => block.id === timeBlockForm.initialData?.id) ??
      (timeBlockForm.initialData as TimeBlock)
    : undefined;
  const selectedTask = selectedBlock?.taskId
    ? tasks.find((task) => task.id === selectedBlock.taskId)
    : undefined;
  const selectedTaskTimerActive = selectedTask
    ? activeTimer?.taskId === selectedTask.id
    : false;
  const selectedTaskActionPanel =
    selectedBlock && selectedTask ? (
      <TaskBlockActionPanel
        block={selectedBlock}
        task={selectedTask}
        isTimerActive={selectedTaskTimerActive}
        isTimerRunning={selectedTaskTimerActive ? isTimerRunning : false}
        onStart={() => startTimer(selectedTask.id, selectedBlock.id)}
        onResume={resumeTimer}
        onStop={() => stopTimer()}
        onDone={() => completeTask(selectedTask.id)}
      />
    ) : null;
  const handleBlockClick = (block: TimeBlock) => {
    if (isProjectBoundaryBlock(block)) {
      return;
    }

    timeBlockForm.openEdit(block);
  };

  return (
    <PageShell>
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f5f9ff_48%,#f8fafc_100%)] shadow-sm shadow-slate-200/60">
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <CalendarClock className="h-3.5 w-3.5" />
              {heroBadge}
            </div>
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Calendar
              </h1>
              <div className="grid gap-3 sm:grid-cols-3">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleQuickAction(action.id)}
                      className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/90 p-4 text-left shadow-sm shadow-slate-200/50 transition-colors hover:border-slate-300 hover:bg-white"
                    >
                      <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{action.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {action.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile
              label={metricLabel}
              value={formatMinutes(scheduledMinutes)}
              detail={`${visibleBlocks.length} blocks`}
            />
            <MetricTile
              label="Tracked so far"
              value={formatMinutes(trackedMinutes)}
              detail={`${executionRate}% execution`}
            />
            <MetricTile
              label="Week earnings"
              value={earningsLabel}
              detail={
                earningsByCurrency.length > 0
                  ? `${linkedBlockCount} task-linked blocks`
                  : 'Add a rate to a category or event'
              }
            />
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,4fr)_minmax(280px,1fr)] xl:items-start">
        <Card className="overflow-hidden rounded-[28px] border-slate-200 shadow-sm shadow-slate-200/60">
          <CardHeader className="border-slate-200 px-0 py-0">
            <div className="flex flex-col gap-5 px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-semibold text-slate-950">
                    {focusTitle}
                  </CardTitle>
                  <p className="text-sm text-slate-600">{rangeLabel}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
                    {(['day', 'week', 'month'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleViewModeChange(mode)}
                        className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                          viewMode === mode
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={openCreateBlock}
                    className="rounded-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New event
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToPreviousPeriod}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-slate-700"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setDraftBlock(null);
                      setCurrentDate(new Date());
                    }}
                    className="rounded-full bg-slate-100 px-3 text-slate-800"
                  >
                    {resetLabel}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToNextPeriod}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-slate-700"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      Categories
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Click any category to edit it or add one before you start blocking time.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => categoryForm.openCreate()}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-slate-700"
                  >
                    <Plus className="h-4 w-4" />
                    New category
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => categoryForm.openEdit(category)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                      <Pencil className="h-3 w-3 text-slate-400" />
                      {!category.active ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
                          Inactive
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-0 py-0">
            {viewMode === 'day' ? (
              <DayPlannerView
                day={currentDate}
                blocks={visibleBlocks}
                today={today}
                plannerHeight={plannerHeight}
                categoryMap={categoryMap}
                categories={categories}
                tasks={tasks}
                draftBlock={draftBlock}
                onDraftCreate={handleDraftCreate}
                onDraftChange={handleDraftChange}
                onDraftSave={handleDraftSave}
                onDraftCancel={handleDraftCancel}
                onDraftExpand={handleDraftExpand}
                onTaskBlockMove={handleCalendarEventMove}
                onTaskBlockResize={handleCalendarEventResize}
                onBlockClick={handleBlockClick}
                onBlockContextMenu={handleBlockContextMenu}
                onEmptySlotContextMenu={handleGridPasteTargetContextMenu}
              />
            ) : viewMode === 'week' ? (
              <WeekPlannerView
                days={visibleDays}
                blocks={visibleBlocks}
                today={today}
                plannerHeight={plannerHeight}
                categoryMap={categoryMap}
                categories={categories}
                tasks={tasks}
                draftBlock={draftBlock}
                onDraftCreate={handleDraftCreate}
                onDraftChange={handleDraftChange}
                onDraftSave={handleDraftSave}
                onDraftCancel={handleDraftCancel}
                onDraftExpand={handleDraftExpand}
                onTaskBlockMove={handleCalendarEventMove}
                onTaskBlockResize={handleCalendarEventResize}
                onBlockClick={handleBlockClick}
                onBlockContextMenu={handleBlockContextMenu}
                onEmptySlotContextMenu={handleGridPasteTargetContextMenu}
              />
            ) : (
              <MonthPlannerView
                monthDays={monthGridDays}
                currentDate={currentDate}
                blocks={summaryBlocks}
                tasks={visibleTasks}
                today={today}
                categoryMap={categoryMap}
                onBlockClick={handleBlockClick}
                onBlockContextMenu={handleBlockContextMenu}
                onDayContextMenu={handleGridPasteTargetContextMenu}
              />
            )}
          </CardContent>
        </Card>

        <aside className="space-y-3 xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)] xl:overflow-y-auto">
          <WeekProgressCard
            referenceDate={currentDate}
            title="Time completion"
            description="Switch between day and week completion for the currently viewed calendar period."
          />

          <Card className="rounded-[24px] border-slate-200 shadow-sm shadow-slate-200/60">
            <CardHeader>
              <CardTitle className="text-base">Category analytics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {categorySummaries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  No category totals yet. Create your first block to start the weekly breakdown.
                </div>
              ) : (
                categorySummaries.map((summary) => (
                  <CategoryAnalyticsRow key={summary.category.id} summary={summary} />
                ))
              )}
              {topCategory ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-900">Top category in view</p>
                  <p className="mt-1">
                    {topCategory.label} has logged {formatMinutes(topCategory.actualMinutes)}{' '}
                    this week with{' '}
                    {topCategory.scheduledMinutes > 0
                      ? `${formatMinutes(topCategory.scheduledMinutes)} still on the calendar`
                      : 'no time left on the calendar'}{' '}
                    across {topCategory.blockCount} blocks
                    {topCategory.earningsLabel ? ` and ${topCategory.earningsLabel} earned.` : '.'}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-slate-200 shadow-sm shadow-slate-200/60">
            <CardHeader>
              <CardTitle className="text-base">Todo preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  No open tasks due in this view.
                </div>
              ) : (
                visibleTasks.slice(0, 5).map((task) => (
                  <TaskPreviewItem
                    key={task.id}
                    task={task}
                    category={categoryMap.get(task.categoryId)}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-slate-200 shadow-sm shadow-slate-200/60">
            <CardHeader>
              <CardTitle className="text-base">Scheduled vs tracked</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <SummaryTile
                  label="Scheduled"
                  value={formatMinutes(scheduledMinutes)}
                  icon={Layers3}
                />
                <SummaryTile
                  label="Tracked"
                  value={formatMinutes(trackedMinutes)}
                  icon={Clock3}
                />
                <SummaryTile
                  label="Earnings"
                  value={earningsLabel}
                  icon={TrendingUp}
                />
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Execution rate</p>
                    <p className="text-xs text-slate-500">
                      Based on tracked time against scheduled calendar hours
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-slate-950">{executionRate}%</p>
                    <p
                      className={`text-xs font-medium ${
                        varianceMinutes >= 0 ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {varianceMinutes >= 0 ? '+' : '-'}
                      {formatMinutes(Math.abs(varianceMinutes))}
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${
                      executionRate >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(executionRate, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InsightPill
                  title="Today scheduled"
                  value={formatMinutes(todaysScheduledMinutes)}
                  tone="blue"
                />
                <InsightPill
                  title="Today tracked"
                  value={formatMinutes(todaysTrackedMinutes)}
                  tone="green"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Reality check</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {linkedBlockCount} blocks are tied to tasks and {syncedBlockCount} are
                      coming from Google Calendar, which keeps the plan grounded in real
                      commitments.
                    </p>
                  </div>
                  {varianceMinutes >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-amber-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <TimeBlockForm
        open={timeBlockForm.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            timeBlockForm.close();
          }
        }}
        mode={timeBlockForm.mode}
        initialData={selectedBlock ?? timeBlockForm.initialData}
        categories={categories}
        tags={tags}
        tasks={tasks}
        onSubmit={handleTimeBlockSubmit}
        onDelete={handleTimeBlockDelete}
        onAddNote={
          selectedBlock ? (input) => addTimeBlockNote(selectedBlock.id, input) : undefined
        }
        taskActionPanel={selectedTaskActionPanel}
      />

      <CategoryForm
        open={categoryForm.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            categoryForm.close();
          }
        }}
        mode={categoryForm.mode}
        initialData={categoryForm.initialData}
        categories={categories}
        onSubmit={handleCategorySubmit}
      />

      {contextMenu ? (
        <CalendarContextMenu
          menu={contextMenu}
          canPaste={Boolean(copiedBlock)}
          onCopy={() => {
            if (contextMenu.kind === 'event') {
              handleCopyBlock(contextMenu.block);
            }
          }}
          onDelete={() => {
            if (contextMenu.kind === 'event') {
              handleContextDelete(contextMenu.block);
            }
          }}
          onPaste={() => {
            if (contextMenu.kind === 'paste-target') {
              handlePasteBlock(contextMenu.start, contextMenu.preserveCopiedTime);
            }
          }}
          onClose={() => setContextMenu(null)}
        />
      ) : null}

      <Dialog open={Boolean(deleteTargetBlock)} onOpenChange={(open) => {
        if (!open) {
          setDeleteTargetBlock(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete repeating event?</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm leading-6 text-slate-600">
              Choose how much of this repeating event to remove from the calendar.
            </p>

            <button
              type="button"
              onClick={() => handleScopedContextDelete('single')}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-slate-900">Delete this event</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Remove only this one occurrence and keep the rest of the series.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleScopedContextDelete('following')}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-slate-900">Delete this and following events</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Keep earlier events, but remove this occurrence and everything after it.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleScopedContextDelete('all')}
              className="w-full rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3 text-left transition-colors hover:border-red-300 hover:bg-red-50"
            >
              <p className="text-sm font-medium text-red-700">Delete all events in the series</p>
              <p className="mt-1 text-xs leading-5 text-red-600/80">
                Remove every event in this repeating set.
              </p>
            </button>
          </div>

          <div className="mt-5 flex justify-end">
            <Button variant="ghost" onClick={() => setDeleteTargetBlock(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingRecurringChange)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRecurringChange(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply change to repeating event?</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm leading-6 text-slate-600">
              Choose how widely this calendar change should apply across the repeating event.
            </p>

            <button
              type="button"
              onClick={() => {
                if (pendingRecurringChange) {
                  applyRecurringCalendarChange(pendingRecurringChange, 'single');
                  setPendingRecurringChange(null);
                }
              }}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-slate-900">Save just this event</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Only this occurrence keeps the new task, time, or duration change.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                if (pendingRecurringChange) {
                  applyRecurringCalendarChange(pendingRecurringChange, 'following');
                  setPendingRecurringChange(null);
                }
              }}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-slate-900">Save this and following events</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Keep earlier events unchanged and apply the change from this point forward.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                if (pendingRecurringChange) {
                  applyRecurringCalendarChange(pendingRecurringChange, 'all');
                  setPendingRecurringChange(null);
                }
              }}
              className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
            >
              <p className="text-sm font-medium text-slate-900">Save all events in the series</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Apply the change to every occurrence in this repeating set.
              </p>
            </button>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setPendingRecurringChange(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function DayPlannerView({
  day,
  blocks,
  today,
  plannerHeight,
  categoryMap,
  categories,
  tasks,
  draftBlock,
  onDraftCreate,
  onDraftChange,
  onDraftSave,
  onDraftCancel,
  onDraftExpand,
  onTaskBlockMove,
  onTaskBlockResize,
  onBlockClick,
  onBlockContextMenu,
  onEmptySlotContextMenu,
}: {
  day: Date;
  blocks: TimeBlock[];
  today: Date;
  plannerHeight: number;
  categoryMap: Map<Category['id'], Category>;
  categories: Category[];
  tasks: Task[];
  draftBlock: CalendarDraftBlock | null;
  onDraftCreate: (start: Date) => void;
  onDraftChange: (draft: CalendarDraftBlock) => void;
  onDraftSave: () => void;
  onDraftCancel: () => void;
  onDraftExpand: () => void;
  onTaskBlockMove: (block: TimeBlock, start: Date, end: Date) => void;
  onTaskBlockResize: (block: TimeBlock, start: Date, end: Date) => void;
  onBlockClick?: (block: TimeBlock) => void;
  onBlockContextMenu?: (event: ReactMouseEvent<HTMLElement>, block: TimeBlock) => void;
  onEmptySlotContextMenu?: (event: ReactMouseEvent<HTMLDivElement>, start: Date, preserveCopiedTime?: boolean) => void;
}) {
  const isToday = isSameDay(day, today);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">
        <div
          className="grid border-b border-slate-200 bg-slate-50/80"
          style={{ gridTemplateColumns: `${PLANNER_TIME_RAIL_WIDTH}px minmax(0, 1fr)` }}
        >
          <div className="border-r border-slate-200 px-2.5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Time
          </div>
          <div className={`px-3 py-3.5 text-center ${isToday ? 'bg-blue-50/70' : ''}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              {format(day, 'EEEE')}
            </p>
            <p className={`mt-2 text-3xl font-semibold ${isToday ? 'text-blue-700' : 'text-slate-950'}`}>
              {format(day, 'd')}
            </p>
            <p className="mt-1 text-xs text-slate-500">{format(day, 'MMMM yyyy')}</p>
          </div>
        </div>

        <PlannerGridSurface
          days={[day]}
          blocks={blocks}
          today={today}
          plannerHeight={plannerHeight}
          categoryMap={categoryMap}
          categories={categories}
          tasks={tasks}
          draftBlock={draftBlock}
          onDraftCreate={onDraftCreate}
          onDraftChange={onDraftChange}
          onDraftSave={onDraftSave}
          onDraftCancel={onDraftCancel}
          onDraftExpand={onDraftExpand}
          onTaskBlockMove={onTaskBlockMove}
          onTaskBlockResize={onTaskBlockResize}
          onBlockClick={onBlockClick}
          onBlockContextMenu={onBlockContextMenu}
          onEmptySlotContextMenu={onEmptySlotContextMenu}
          emptyLabel="Open capacity for this day."
        />
      </div>
    </div>
  );
}

function WeekPlannerView({
  days,
  blocks,
  today,
  plannerHeight,
  categoryMap,
  categories,
  tasks,
  draftBlock,
  onDraftCreate,
  onDraftChange,
  onDraftSave,
  onDraftCancel,
  onDraftExpand,
  onTaskBlockMove,
  onTaskBlockResize,
  onBlockClick,
  onBlockContextMenu,
  onEmptySlotContextMenu,
}: {
  days: Date[];
  blocks: TimeBlock[];
  today: Date;
  plannerHeight: number;
  categoryMap: Map<Category['id'], Category>;
  categories: Category[];
  tasks: Task[];
  draftBlock: CalendarDraftBlock | null;
  onDraftCreate: (start: Date) => void;
  onDraftChange: (draft: CalendarDraftBlock) => void;
  onDraftSave: () => void;
  onDraftCancel: () => void;
  onDraftExpand: () => void;
  onTaskBlockMove: (block: TimeBlock, start: Date, end: Date) => void;
  onTaskBlockResize: (block: TimeBlock, start: Date, end: Date) => void;
  onBlockClick?: (block: TimeBlock) => void;
  onBlockContextMenu?: (event: ReactMouseEvent<HTMLElement>, block: TimeBlock) => void;
  onEmptySlotContextMenu?: (event: ReactMouseEvent<HTMLDivElement>, start: Date, preserveCopiedTime?: boolean) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[920px]">
        <div
          className="grid border-b border-slate-200 bg-slate-50/80"
          style={{ gridTemplateColumns: `${PLANNER_TIME_RAIL_WIDTH}px repeat(7, minmax(0, 1fr))` }}
        >
          <div className="border-r border-slate-200 px-2.5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Time
          </div>
          {days.map((day) => {
            const isToday = isSameDay(day, today);
            return (
              <div
                key={day.toISOString()}
                className={`border-r border-slate-200 px-3 py-3.5 text-center last:border-r-0 ${
                  isToday ? 'bg-blue-50/70' : ''
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {format(day, 'EEE')}
                </p>
                <p className={`mt-2 text-2xl font-semibold ${isToday ? 'text-blue-700' : 'text-slate-950'}`}>
                  {format(day, 'd')}
                </p>
                <p className="mt-1 text-xs text-slate-500">{format(day, 'MMM')}</p>
              </div>
            );
          })}
        </div>

        <PlannerGridSurface
          days={days}
          blocks={blocks}
          today={today}
          plannerHeight={plannerHeight}
          categoryMap={categoryMap}
          categories={categories}
          tasks={tasks}
          draftBlock={draftBlock}
          onDraftCreate={onDraftCreate}
          onDraftChange={onDraftChange}
          onDraftSave={onDraftSave}
          onDraftCancel={onDraftCancel}
          onDraftExpand={onDraftExpand}
          onTaskBlockMove={onTaskBlockMove}
          onTaskBlockResize={onTaskBlockResize}
          onBlockClick={onBlockClick}
          onBlockContextMenu={onBlockContextMenu}
          onEmptySlotContextMenu={onEmptySlotContextMenu}
          emptyLabel="Open capacity"
        />
      </div>
    </div>
  );
}

function PlannerGridSurface({
  days,
  blocks,
  today,
  plannerHeight,
  categoryMap,
  categories,
  tasks,
  draftBlock,
  onDraftCreate,
  onDraftChange,
  onDraftSave,
  onDraftCancel,
  onDraftExpand,
  onTaskBlockMove,
  onTaskBlockResize,
  onBlockClick,
  onBlockContextMenu,
  onEmptySlotContextMenu,
  emptyLabel,
}: {
  days: Date[];
  blocks: TimeBlock[];
  today: Date;
  plannerHeight: number;
  categoryMap: Map<Category['id'], Category>;
  categories: Category[];
  tasks: Task[];
  draftBlock: CalendarDraftBlock | null;
  onDraftCreate: (start: Date) => void;
  onDraftChange: (draft: CalendarDraftBlock) => void;
  onDraftSave: () => void;
  onDraftCancel: () => void;
  onDraftExpand: () => void;
  onTaskBlockMove: (block: TimeBlock, start: Date, end: Date) => void;
  onTaskBlockResize: (block: TimeBlock, start: Date, end: Date) => void;
  onBlockClick?: (block: TimeBlock) => void;
  onBlockContextMenu?: (event: ReactMouseEvent<HTMLElement>, block: TimeBlock) => void;
  onEmptySlotContextMenu?: (event: ReactMouseEvent<HTMLDivElement>, start: Date, preserveCopiedTime?: boolean) => void;
  emptyLabel: string;
}) {
  const daysContainerRef = useRef<HTMLDivElement>(null);
  const savedInteractionPreviewRef = useRef<SavedBlockInteractionPreview | null>(null);
  const suppressedClickBlockIdRef = useRef<TimeBlock['id'] | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [interaction, setInteraction] = useState<DraftInteractionState | null>(null);
  const [savedInteraction, setSavedInteraction] = useState<SavedBlockInteractionState | null>(null);
  const [savedInteractionPreview, setSavedInteractionPreview] = useState<SavedBlockInteractionPreview | null>(null);

  useEffect(() => {
    const syncWidth = () => {
      setContainerWidth(daysContainerRef.current?.clientWidth ?? 0);
    };

    syncWidth();
    window.addEventListener('resize', syncWidth);

    return () => {
      window.removeEventListener('resize', syncWidth);
    };
  }, []);

  useEffect(() => {
    if (!interaction || !draftBlock) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const container = daysContainerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const pointerMinutes = getPointerMinutesFromGrid(event.clientY, rect.top, plannerHeight);
      const draftDayIndex = getDayIndexForDate(days, draftBlock.start);

      if (draftDayIndex < 0) {
        return;
      }

      if (interaction.mode === 'move') {
        const nextDayIndex = getDayIndexFromPointer(event.clientX, rect.left, rect.width, days.length);
        const nextStartOffset = clampGridMinutes(
          pointerMinutes - interaction.minuteGrabOffset,
          interaction.durationMinutes
        );
        const nextStart = getDateForGridOffset(days[nextDayIndex], nextStartOffset);
        const nextEnd = add(nextStart, { minutes: interaction.durationMinutes });

        onDraftChange({
          ...draftBlock,
          start: nextStart,
          end: nextEnd,
        });

        return;
      }

      if (interaction.mode === 'resize-start') {
        const endOffset = getMinutesFromGridStart(draftBlock.end);
        const nextStartOffset = clamp(
          snapMinutes(pointerMinutes),
          0,
          Math.max(endOffset - MIN_BLOCK_MINUTES, 0)
        );
        const nextStart = getDateForGridOffset(days[draftDayIndex], nextStartOffset);

        onDraftChange({
          ...draftBlock,
          start: nextStart,
          end: ensureDraftEnd(nextStart, draftBlock.end),
        });

        return;
      }

      const startOffset = getMinutesFromGridStart(draftBlock.start);
      const nextEndOffset = clamp(
        snapMinutes(pointerMinutes),
        startOffset + MIN_BLOCK_MINUTES,
        GRID_TOTAL_MINUTES
      );
      const nextEnd = getDateForGridOffset(days[draftDayIndex], nextEndOffset);

      onDraftChange({
        ...draftBlock,
        end: nextEnd,
      });
    };

    const handlePointerUp = () => {
      setInteraction(null);
      document.body.style.userSelect = '';
    };

    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [days, draftBlock, interaction, onDraftChange, plannerHeight]);

  useEffect(() => {
    if (!savedInteraction) {
      return;
    }

    const block = blocks.find((item) => item.id === savedInteraction.blockId);
    if (!block) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const container = daysContainerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const pointerMinutes = getPointerMinutesFromGrid(event.clientY, rect.top, plannerHeight);
      const blockDayIndex = getDayIndexForDate(days, block.start);

      if (blockDayIndex < 0) {
        return;
      }

      if (savedInteraction.mode === 'move') {
        const nextDayIndex = getDayIndexFromPointer(event.clientX, rect.left, rect.width, days.length);
        const nextStartOffset = clampGridMinutes(
          pointerMinutes - savedInteraction.minuteGrabOffset,
          savedInteraction.durationMinutes
        );
        const nextStart = getDateForGridOffset(days[nextDayIndex], nextStartOffset);
        const nextEnd = add(nextStart, { minutes: savedInteraction.durationMinutes });
        const constrainedRange = constrainTimeBlockRangeToParent(block, nextStart, nextEnd, blocks);

        const preview = {
          blockId: block.id,
          start: constrainedRange.start,
          end: constrainedRange.end,
        };
        savedInteractionPreviewRef.current = preview;
        setSavedInteractionPreview(preview);
        return;
      }

      if (savedInteraction.mode === 'resize-start') {
        const endOffset = getMinutesFromGridStart(block.end);
        const nextStartOffset = clamp(
          snapMinutes(pointerMinutes),
          0,
          Math.max(endOffset - MIN_BLOCK_MINUTES, 0)
        );
        const nextStart = getDateForGridOffset(days[blockDayIndex], nextStartOffset);
        const constrainedRange = constrainTimeBlockRangeToParent(
          block,
          nextStart,
          ensureDraftEnd(nextStart, block.end),
          blocks
        );

        const preview = {
          blockId: block.id,
          start: constrainedRange.start,
          end: constrainedRange.end,
        };
        savedInteractionPreviewRef.current = preview;
        setSavedInteractionPreview(preview);
        return;
      }

      const startOffset = getMinutesFromGridStart(block.start);
      const nextEndOffset = clamp(
        snapMinutes(pointerMinutes),
        startOffset + MIN_BLOCK_MINUTES,
        GRID_TOTAL_MINUTES
      );
      const nextEnd = getDateForGridOffset(days[blockDayIndex], nextEndOffset);
      const constrainedRange = constrainTimeBlockRangeToParent(block, block.start, nextEnd, blocks);

      const preview = {
        blockId: block.id,
        start: constrainedRange.start,
        end: constrainedRange.end,
      };
      savedInteractionPreviewRef.current = preview;
      setSavedInteractionPreview(preview);
    };

    const handlePointerUp = () => {
      const preview = savedInteractionPreviewRef.current;
      const didChange =
        preview &&
        (preview.start.getTime() !== block.start.getTime() ||
          preview.end.getTime() !== block.end.getTime());

      savedInteractionPreviewRef.current = null;
      setSavedInteractionPreview(null);
      setSavedInteraction(null);
      document.body.style.userSelect = '';

      if (!preview || !didChange) {
        return;
      }

      suppressedClickBlockIdRef.current = block.id;
      window.setTimeout(() => {
        if (suppressedClickBlockIdRef.current === block.id) {
          suppressedClickBlockIdRef.current = null;
        }
      }, 0);

      if (savedInteraction.mode === 'move') {
        onTaskBlockMove(block, preview.start, preview.end);
        return;
      }

      onTaskBlockResize(block, preview.start, preview.end);
    };

    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [blocks, days, onTaskBlockMove, onTaskBlockResize, plannerHeight, savedInteraction]);

  const draftDayIndex = draftBlock ? getDayIndexForDate(days, draftBlock.start) : -1;
  const draftLayout = draftBlock ? getDraftLayout(draftBlock.start, draftBlock.end) : null;
  const draftEditorPosition =
    draftBlock && draftLayout && containerWidth > 0
      ? getDraftEditorPosition(draftDayIndex, draftLayout.top, containerWidth, days.length, plannerHeight)
      : null;
  const dayWidth = containerWidth > 0 ? containerWidth / Math.max(days.length, 1) : 140;
  const renderedBlocks = savedInteractionPreview
    ? blocks.map((block) =>
        block.id === savedInteractionPreview.blockId
          ? {
              ...block,
              start: savedInteractionPreview.start,
              end: savedInteractionPreview.end,
              actualMinutes:
                savedInteraction?.mode === 'move'
                  ? block.actualMinutes
                  : Math.max(
                      calculateDurationMinutes(
                        savedInteractionPreview.start,
                        savedInteractionPreview.end
                      ),
                      1
                    ),
            }
          : block
      )
    : blocks;

  const handleCellClick = (day: Date, event: ReactMouseEvent<HTMLDivElement>) => {
    if (draftBlock) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const pointerMinutes = getPointerMinutesFromGrid(event.clientY, rect.top, plannerHeight);
    const start = getDateForGridOffset(day, pointerMinutes);
    onDraftCreate(start);
  };

  const handleCellContextMenu = (day: Date, event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onEmptySlotContextMenu) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const pointerMinutes = getPointerMinutesFromGrid(event.clientY, rect.top, plannerHeight);
    const start = getDateForGridOffset(day, pointerMinutes);
    onEmptySlotContextMenu(event, start, false);
  };

  const handleDraftMoveStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draftBlock) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const container = daysContainerRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const pointerMinutes = getPointerMinutesFromGrid(event.clientY, rect.top, plannerHeight);
    const startOffset = getMinutesFromGridStart(draftBlock.start);

    setInteraction({
      mode: 'move',
      pointerId: event.pointerId,
      minuteGrabOffset: pointerMinutes - startOffset,
      durationMinutes: calculateDurationMinutes(draftBlock.start, draftBlock.end),
    });
  };

  const handleDraftResizeStart = (
    event: ReactPointerEvent<HTMLButtonElement>,
    mode: 'resize-start' | 'resize-end'
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setInteraction({
      mode,
      pointerId: event.pointerId,
    });
  };

  const handleSavedBlockMoveStart = (
    event: ReactPointerEvent<HTMLElement>,
    block: TimeBlock
  ) => {
    event.stopPropagation();
    const container = daysContainerRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const pointerMinutes = getPointerMinutesFromGrid(event.clientY, rect.top, plannerHeight);
    const startOffset = getMinutesFromGridStart(block.start);

    savedInteractionPreviewRef.current = null;
    setSavedInteractionPreview(null);
    setSavedInteraction({
      mode: 'move',
      pointerId: event.pointerId,
      blockId: block.id,
      minuteGrabOffset: pointerMinutes - startOffset,
      durationMinutes: Math.max(calculateDurationMinutes(block.start, block.end), MIN_BLOCK_MINUTES),
    });
  };

  const handleSavedBlockResizeStart = (
    event: ReactPointerEvent<HTMLButtonElement>,
    block: TimeBlock,
    mode: 'resize-start' | 'resize-end'
  ) => {
    event.preventDefault();
    event.stopPropagation();
    savedInteractionPreviewRef.current = null;
    setSavedInteractionPreview(null);
    setSavedInteraction({
      mode,
      pointerId: event.pointerId,
      blockId: block.id,
    });
  };

  const handleRenderedBlockClick = (block: TimeBlock) => {
    if (suppressedClickBlockIdRef.current === block.id) {
      suppressedClickBlockIdRef.current = null;
      return;
    }

    onBlockClick?.(block);
  };

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `${PLANNER_TIME_RAIL_WIDTH}px minmax(0, 1fr)` }}
    >
      <div className="relative border-r border-slate-200 bg-slate-50/40">
        {TIME_SLOTS.map((hour) => (
          <div
            key={hour}
            className="relative border-b border-slate-100 last:border-b-0"
            style={{ height: HOUR_ROW_HEIGHT }}
          >
            <span className="absolute -top-2 right-2 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-500 shadow-sm shadow-slate-200/60">
              {format(setHours(startOfDay(today), hour), 'ha')}
            </span>
          </div>
        ))}
      </div>

      <div
        ref={daysContainerRef}
        className="relative grid"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((day) => {
          const dayBlocks = renderedBlocks.filter((block) => isSameDay(block.start, day));
          const topLevelDayBlocks = dayBlocks.filter(isTopLevelTimeBlock);
          const topLevelBlockIds = new Set(topLevelDayBlocks.map((block) => block.id));
          const orphanNestedBlocks = dayBlocks.filter(
            (block) => block.parentBlockId && !topLevelBlockIds.has(block.parentBlockId)
          );
          const dayLayouts = getDayEventLayouts(topLevelDayBlocks, dayWidth);
          const orphanLayouts = getDayEventLayouts(orphanNestedBlocks, dayWidth);
          const isToday = isSameDay(day, today);
          const hasDraftOnDay = draftBlock ? isSameDay(draftBlock.start, day) : false;

          return (
            <div
              key={day.toISOString()}
              onClick={(event) => handleCellClick(day, event)}
              onContextMenu={(event) => handleCellContextMenu(day, event)}
              className={`relative cursor-cell border-r border-slate-200 last:border-r-0 ${
                isToday ? 'bg-blue-50/30' : 'bg-white'
              }`}
              style={{ height: plannerHeight }}
            >
              {TIME_SLOTS.map((hour) => (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className="border-b border-slate-100 last:border-b-0"
                  style={{ height: HOUR_ROW_HEIGHT }}
                />
              ))}

              {dayBlocks.length === 0 && !hasDraftOnDay ? (
                <div className="pointer-events-none absolute inset-x-2 top-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-2.5 py-2 text-xs text-slate-400">
                  {emptyLabel}
                </div>
              ) : null}

              {topLevelDayBlocks.map((block) => {
                const layout = dayLayouts.get(block.id) ?? getFullWidthEventLayout(block, dayWidth);
                const childBlocks = getChildTimeBlocks(dayBlocks, block.id);
                const childLayouts = getNestedEventLayouts(childBlocks, layout);

                return (
                  <div key={block.id}>
                    <CalendarEvent
                      block={block}
                      category={categoryMap.get(block.categoryId)}
                      layout={layout}
                      draggable={!isProjectBoundaryBlock(block)}
                      onMoveStart={(event) => handleSavedBlockMoveStart(event, block)}
                      onResizeStart={(event, mode) => handleSavedBlockResizeStart(event, block, mode)}
                      onClick={() => handleRenderedBlockClick(block)}
                      onContextMenu={(event) => onBlockContextMenu?.(event, block)}
                    />
                    {childBlocks.map((childBlock) => (
                      <CalendarEvent
                        key={childBlock.id}
                        block={childBlock}
                        category={categoryMap.get(childBlock.categoryId)}
                        layout={
                          childLayouts.get(childBlock.id) ??
                          getNestedFallbackEventLayout(childBlock, layout)
                        }
                        draggable
                        onMoveStart={(event) => handleSavedBlockMoveStart(event, childBlock)}
                        onResizeStart={(event, mode) =>
                          handleSavedBlockResizeStart(event, childBlock, mode)
                        }
                        onClick={() => handleRenderedBlockClick(childBlock)}
                        onContextMenu={(event) => onBlockContextMenu?.(event, childBlock)}
                        nested
                      />
                    ))}
                  </div>
                );
              })}

              {orphanNestedBlocks.map((block) => (
                <CalendarEvent
                  key={block.id}
                  block={block}
                  category={categoryMap.get(block.categoryId)}
                  layout={orphanLayouts.get(block.id) ?? getFullWidthEventLayout(block, dayWidth)}
                  draggable={!isProjectBoundaryBlock(block)}
                  onMoveStart={(event) => handleSavedBlockMoveStart(event, block)}
                  onResizeStart={(event, mode) => handleSavedBlockResizeStart(event, block, mode)}
                  onClick={() => handleRenderedBlockClick(block)}
                  onContextMenu={(event) => onBlockContextMenu?.(event, block)}
                  nested
                />
              ))}

              {draftBlock && hasDraftOnDay && draftLayout ? (
                <DraftCalendarEvent
                  draft={draftBlock}
                  category={categoryMap.get(draftBlock.categoryId)}
                  layout={draftLayout}
                  onMoveStart={handleDraftMoveStart}
                  onResizeStart={handleDraftResizeStart}
                />
              ) : null}
            </div>
          );
        })}

        {draftBlock && draftEditorPosition ? (
          <DraftTimeBlockEditor
            draft={draftBlock}
            categories={categories}
            tasks={tasks}
            position={draftEditorPosition}
            onChange={onDraftChange}
            onSave={onDraftSave}
            onCancel={onDraftCancel}
            onExpand={onDraftExpand}
          />
        ) : null}
      </div>
    </div>
  );
}

function DraftCalendarEvent({
  draft,
  category,
  layout,
  onMoveStart,
  onResizeStart,
}: {
  draft: CalendarDraftBlock;
  category?: Category;
  layout: { top: number; height: number };
  onMoveStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeStart: (
    event: ReactPointerEvent<HTMLButtonElement>,
    mode: 'resize-start' | 'resize-end'
  ) => void;
}) {
  const color = category?.color ?? '#2563EB';

  return (
    <div
      className="absolute inset-x-2 z-20 overflow-hidden rounded-2xl border-2 shadow-lg shadow-slate-300/70"
      style={{
        top: layout.top,
        height: layout.height,
        backgroundColor: withAlpha(color, 0.18),
        borderColor: withAlpha(color, 0.52),
      }}
    >
      <button
        type="button"
        onPointerDown={(event) => onResizeStart(event, 'resize-start')}
        className="absolute inset-x-2 top-0 z-10 h-2 cursor-ns-resize"
        aria-label="Resize event start"
      />
      <button
        type="button"
        onPointerDown={(event) => onResizeStart(event, 'resize-end')}
        className="absolute inset-x-2 bottom-0 z-10 h-2 cursor-ns-resize"
        aria-label="Resize event end"
      />
      <div className="absolute inset-y-2 left-2 w-0.5 rounded-full" style={{ backgroundColor: color }} />
      <div
        onPointerDown={onMoveStart}
        className="flex h-full cursor-grab flex-col gap-1.5 py-2 pl-4 pr-2.5 active:cursor-grabbing"
      >
        <p className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500">
          {format(draft.start, 'h:mm')} - {format(draft.end, 'h:mm a')} · Draft
        </p>
        <p
          className="whitespace-normal font-semibold text-slate-900"
          style={getEventTitleStyle(layout.height, draft.title || 'New event')}
        >
          {draft.title || 'New event'}
        </p>
        <p className="mt-auto text-[10px] text-slate-600">
          Drag to move. Resize from top or bottom.
        </p>
      </div>
    </div>
  );
}

function DraftTimeBlockEditor({
  draft,
  categories,
  tasks,
  position,
  onChange,
  onSave,
  onCancel,
  onExpand,
}: {
  draft: CalendarDraftBlock;
  categories: Category[];
  tasks: Task[];
  position: { left: number; top: number };
  onChange: (draft: CalendarDraftBlock) => void;
  onSave: () => void;
  onCancel: () => void;
  onExpand: () => void;
}) {
  const durationMinutes = calculateDurationMinutes(draft.start, draft.end);

  return (
    <div
      className="absolute z-30 w-[280px] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-300/40"
      style={{ left: position.left, top: position.top }}
      onClick={(event) => event.stopPropagation()}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
        New event
      </p>
      <p className="mt-2 text-sm font-medium text-slate-900">
        {format(draft.start, 'EEE h:mm a')} - {format(draft.end, 'h:mm a')}
      </p>
      <p className="mt-1 text-xs text-slate-500">{formatMinutes(durationMinutes)}</p>

      <div className="mt-4 space-y-3">
        <Input
          value={draft.title}
          placeholder="Event title"
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          className="h-10 rounded-2xl"
        />

        <Select
          value={draft.categoryId}
          onChange={(event) =>
            onChange({ ...draft, categoryId: event.target.value as Category['id'] })
          }
          options={categories.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
          className="h-10 rounded-2xl"
        />

        <Select
          value={draft.taskId ?? ''}
          onChange={(event) =>
            onChange({
              ...draft,
              taskId: event.target.value ? (event.target.value as Task['id']) : undefined,
            })
          }
          options={[
            { value: '', label: 'No child task' },
            ...tasks
              .filter((task) => task.status !== 'done')
              .map((task) => ({ value: task.id, label: task.title })),
          ]}
          className="h-10 rounded-2xl"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={onSave} className="rounded-full">
          Save event
        </Button>
        <Button size="sm" variant="ghost" onClick={onExpand} className="rounded-full border border-slate-200 bg-white">
          More details
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="rounded-full">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function MonthPlannerView({
  monthDays,
  currentDate,
  blocks,
  tasks,
  today,
  categoryMap,
  onBlockClick,
  onBlockContextMenu,
  onDayContextMenu,
}: {
  monthDays: Date[];
  currentDate: Date;
  blocks: TimeBlock[];
  tasks: Task[];
  today: Date;
  categoryMap: Map<Category['id'], Category>;
  onBlockClick?: (block: TimeBlock) => void;
  onBlockContextMenu?: (event: ReactMouseEvent<HTMLElement>, block: TimeBlock) => void;
  onDayContextMenu?: (event: ReactMouseEvent<HTMLDivElement>, start: Date, preserveCopiedTime?: boolean) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
            <div
              key={label}
              className="border-r border-slate-200 px-4 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 last:border-r-0"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {monthDays.map((day) => {
            const dayBlocks = blocks.filter((block) => isSameDay(block.start, day));
            const dayTasks = tasks.filter((task) => task.dueDate && isSameDay(task.dueDate, day));
            const isToday = isSameDay(day, today);
            const inCurrentMonth = isSameMonth(day, currentDate);

            return (
              <div
                key={day.toISOString()}
                onContextMenu={(event) => onDayContextMenu?.(event, day, true)}
                className={`min-h-[176px] border-b border-r border-slate-200 p-3 align-top last:border-r-0 ${
                  inCurrentMonth ? 'bg-white' : 'bg-slate-50/60'
                } ${isToday ? 'bg-blue-50/30' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {format(day, 'EEE')}
                    </p>
                    <p
                      className={`mt-1 text-xl font-semibold ${
                        isToday ? 'text-blue-700' : inCurrentMonth ? 'text-slate-950' : 'text-slate-400'
                      }`}
                    >
                      {format(day, 'd')}
                    </p>
                  </div>
                  {dayBlocks.length > 0 ? (
                    <div className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">
                      {dayBlocks.length} block{dayBlocks.length === 1 ? '' : 's'}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2">
                  {dayBlocks.slice(0, 3).map((block) => (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => onBlockClick?.(block)}
                      onContextMenu={(event) => {
                        if (isProjectBoundaryBlock(block)) {
                          event.preventDefault();
                          event.stopPropagation();
                          return;
                        }

                        event.preventDefault();
                        event.stopPropagation();
                        onBlockContextMenu?.(event, block);
                      }}
                      className="block w-full rounded-xl border px-3 py-2 text-left shadow-sm shadow-slate-200/30 transition-colors hover:border-slate-300"
                      style={{
                        backgroundColor: withAlpha(categoryMap.get(block.categoryId)?.color ?? '#64748B', 0.12),
                        borderColor: withAlpha(categoryMap.get(block.categoryId)?.color ?? '#64748B', 0.22),
                      }}
                    >
                      <p className="whitespace-normal break-words text-[11px] font-medium leading-4 text-slate-900">
                        {block.title}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-slate-600">
                        {format(block.start, 'h:mm a')}
                      </p>
                    </button>
                  ))}

                  {dayBlocks.length > 3 ? (
                    <p className="text-xs font-medium text-slate-500">+{dayBlocks.length - 3} more blocks</p>
                  ) : null}

                  {dayTasks.length > 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      {dayTasks.length} task{dayTasks.length === 1 ? '' : 's'} due
                    </div>
                  ) : null}

                  {dayBlocks.length === 0 && dayTasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 text-xs text-slate-400">
                      Open capacity
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CalendarContextMenu({
  menu,
  canPaste,
  onCopy,
  onDelete,
  onPaste,
  onClose,
}: {
  menu: CalendarContextMenuState;
  canPaste: boolean;
  onCopy: () => void;
  onDelete: () => void;
  onPaste: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-300/40"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
    >
      {menu.kind === 'event' ? (
        <>
          <button
            type="button"
            onClick={onCopy}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
          >
            <Copy className="h-4 w-4 text-slate-400" />
            Copy event
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 text-red-400" />
            Delete event
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onPaste}
            disabled={!canPaste}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ClipboardPaste className="h-4 w-4 text-slate-400" />
            Paste event
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}

function CalendarEvent({
  block,
  category,
  layout,
  draggable = false,
  nested = false,
  onMoveStart,
  onResizeStart,
  onClick,
  onContextMenu,
}: {
  block: TimeBlock;
  category?: Category;
  layout: CalendarEventLayout;
  draggable?: boolean;
  nested?: boolean;
  onMoveStart?: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizeStart?: (
    event: ReactPointerEvent<HTMLButtonElement>,
    mode: 'resize-start' | 'resize-end'
  ) => void;
  onClick?: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  const { top, height } = layout;
  const color = category?.color ?? '#64748B';
  const isProjectMarker = isProjectBoundaryBlock(block);
  const isNarrow = layout.width < 132;
  const isVeryNarrow = layout.width < 104;
  const isStacked = layout.columns > 1;
  const descriptionClamp = height < 104 || isNarrow ? 1 : height < 148 ? 2 : 3;
  const showDescription = !isProjectMarker && height >= 88 && !isVeryNarrow;
  const showFooter = isProjectMarker ? height >= 54 : height >= 86 && !isVeryNarrow;
  const showFooterBadges = !isProjectMarker && layout.width >= 160 && height >= 112;
  const itemLabel = isProjectMarker
    ? block.projectBoundaryType === 'start'
      ? 'Project start'
      : 'Project end'
    : nested
      ? 'Task child'
    : block.taskId
      ? 'Task block'
      : 'Event';
  const earnings = calculateTimeBlockEarnings(block, category);
  const earningsLabel =
    earnings !== null && earnings > 0
      ? formatCurrencyBreakdown([
          {
            amount: earnings,
            currency: resolveTimeBlockCurrency(block, category),
          },
        ])
      : null;
  const supplementalLabel =
    isProjectMarker
      ? 'Announcement'
      : block.source === 'google-calendar'
      ? 'Google'
      : block.source === 'pomodoro'
        ? 'Pomodoro'
        : undefined;
  const timeLabel =
    isVeryNarrow
      ? `${format(block.start, 'h:mm')} - ${format(block.end, 'h:mm')}`
      : `${format(block.start, 'h:mm')} - ${format(block.end, 'h:mm a')}`;

  return (
    <div
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      onContextMenu={(event) => {
        onContextMenu?.(event);
      }}
      className="absolute cursor-pointer overflow-hidden rounded-2xl border shadow-sm shadow-slate-200/70"
      style={{
        top,
        height,
        left: layout.left,
        width: layout.width,
        zIndex: layout.zIndex,
        backgroundColor: withAlpha(color, nested ? 0.24 : 0.14),
        borderColor: withAlpha(color, nested ? 0.34 : 0.24),
      }}
    >
      {draggable ? (
        <>
          <button
            type="button"
            onPointerDown={(event) => onResizeStart?.(event, 'resize-start')}
            className="absolute inset-x-1.5 top-0 z-10 h-2 cursor-ns-resize"
            aria-label={`Resize ${block.taskId ? 'task block' : 'event'} start`}
          />
          <button
            type="button"
            onPointerDown={(event) => onResizeStart?.(event, 'resize-end')}
            className="absolute inset-x-1.5 bottom-0 z-10 h-2 cursor-ns-resize"
            aria-label={`Resize ${block.taskId ? 'task block' : 'event'} end`}
          />
        </>
      ) : null}
      <div
        className={`absolute inset-y-2 left-1.5 rounded-full ${isVeryNarrow ? 'w-0.5' : nested ? 'w-0.5' : 'w-1'}`}
        style={{ backgroundColor: color }}
      />
      <div
        onPointerDown={draggable ? onMoveStart : undefined}
        className={`flex h-full flex-col ${
          isProjectMarker
            ? 'gap-1 py-1.5 pl-3 pr-2'
            : isNarrow
              ? 'gap-1 py-1.5 pl-3 pr-1.5'
              : nested
                ? 'gap-1 py-1.5 pl-3.5 pr-2'
                : 'gap-1.5 py-2 pl-4 pr-2.5'
        } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="min-w-0">
          <p className={`font-medium uppercase tracking-[0.12em] text-slate-500 ${isVeryNarrow ? 'text-[7px]' : 'text-[8px]'}`}>
            {timeLabel}
          </p>
          <p
            className="mt-1 whitespace-normal font-semibold text-slate-900"
            style={getEventTitleStyle(height, block.title)}
          >
            {block.title}
          </p>
        </div>

        {showDescription && block.description ? (
          <p
            className={`leading-[1.3] text-slate-600 ${isNarrow ? 'text-[9px]' : 'text-[10px]'}`}
            style={getLineClampStyle(descriptionClamp)}
          >
            {block.description}
          </p>
        ) : null}

        {showFooter ? (
          isProjectMarker ? (
            <div className="mt-auto flex items-center justify-between gap-2 text-[10px] text-slate-600">
              <span className="truncate">{supplementalLabel}</span>
              <span className="rounded-full bg-white/75 px-1.5 py-0.5 font-medium text-[9px] text-slate-600">
                {itemLabel}
              </span>
            </div>
          ) : (
            <div className={`mt-auto flex ${isStacked ? 'items-end' : 'items-center'} justify-between gap-2 text-[10px] text-slate-600`}>
              <span>
                {block.actualMinutes > 0
                  ? `${formatMinutes(block.actualMinutes)} tracked`
                  : `${formatMinutes(getTimeBlockDurationMinutes(block))} on calendar`}
              </span>
              <div className={`flex ${showFooterBadges ? 'items-center' : 'items-end'} gap-1.5 ${showFooterBadges ? 'flex-row' : 'flex-col'}`}>
                {showFooterBadges && earningsLabel ? (
                  <span className="rounded-full bg-white/70 px-1.5 py-0.5 font-medium text-[9px] text-slate-600">
                    {earningsLabel}
                  </span>
                ) : null}
                {!isVeryNarrow ? (
                  <span className="rounded-full bg-white/70 px-1.5 py-0.5 font-medium text-[9px] text-slate-600">
                    {itemLabel}
                  </span>
                ) : null}
                {showFooterBadges && supplementalLabel ? (
                  <span className="rounded-full bg-white/70 px-1.5 py-0.5 font-medium text-[9px] text-slate-600">
                    {supplementalLabel}
                  </span>
                ) : null}
                <span className={getStatusClasses(block.status)}>{formatStatus(block.status)}</span>
              </div>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

function CategoryAnalyticsRow({ summary }: { summary: CategorySummary }) {
  const actualShare =
    summary.totalMinutes === 0
      ? 0
      : Math.min(Math.round((summary.actualMinutes / summary.totalMinutes) * 100), 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-3 w-3 flex-shrink-0 rounded-full"
            style={{ backgroundColor: summary.category.color }}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{summary.category.name}</p>
            <p className="text-xs text-slate-500">{summary.blockCount} blocks in view</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">
            {formatMinutes(summary.actualMinutes)}
          </p>
          <p className="text-xs text-slate-500">
            {summary.scheduledMinutes > 0
              ? `${formatMinutes(summary.scheduledMinutes)} left on calendar`
              : 'No calendar time left'}
          </p>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full"
          style={{
            width: `${actualShare}%`,
            backgroundColor: summary.category.color,
          }}
        />
      </div>
    </div>
  );
}

function TaskBlockActionPanel({
  block,
  task,
  isTimerActive,
  isTimerRunning,
  onStart,
  onResume,
  onStop,
  onDone,
}: {
  block: TimeBlock;
  task: Task;
  isTimerActive: boolean;
  isTimerRunning: boolean;
  onStart: () => void;
  onResume: () => void;
  onStop: () => void;
  onDone: () => void;
}) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-700">
            Calendar task block
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">{task.title}</p>
          <p className="mt-1 text-xs text-slate-600">
            {format(block.start, 'EEE h:mm a')} - {format(block.end, 'h:mm a')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Tracked so far</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {formatMinutes(block.actualMinutes || task.actualMinutes)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!isTimerActive ? (
          <Button size="sm" variant="primary" onClick={onStart} className="rounded-full">
            Start
          </Button>
        ) : isTimerRunning ? (
          <Button size="sm" variant="secondary" onClick={onStop} className="rounded-full">
            Stop
          </Button>
        ) : (
          <Button size="sm" variant="primary" onClick={onResume} className="rounded-full">
            Resume
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDone} className="rounded-full border border-slate-200 bg-white">
          Done
        </Button>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Resize this task block on the calendar or adjust the time spent field below to record
        actual work while preserving the original plan for analytics.
      </p>
    </div>
  );
}

function TaskPreviewItem({
  task,
  category,
}: {
  task: Task;
  category?: Category;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: category?.color ?? '#94A3B8' }}
            />
            <p className="text-sm font-medium text-slate-900">{task.title}</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">{category?.name ?? 'Uncategorized'}</p>
        </div>
        <div className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">
          {task.status}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>{task.dueDate ? formatTaskDue(task.dueDate) : 'No due date'}</span>
        {task.estimatedMinutes ? <span>{formatMinutes(task.estimatedMinutes)}</span> : null}
        {task.scheduledStart ? <span>Timeboxed</span> : null}
      </div>
    </div>
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

function SummaryTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-3 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function InsightPill({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: 'blue' | 'green';
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-80">{title}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function roundUpToQuarterHour(date: Date) {
  const rounded = new Date(date);
  const remainder = rounded.getMinutes() % 15;

  if (remainder !== 0) {
    rounded.setMinutes(rounded.getMinutes() + (15 - remainder));
  }

  rounded.setSeconds(0, 0);
  return rounded;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snapMinutes(minutes: number) {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function getMinutesFromGridStart(date: Date) {
  return (date.getHours() - DAY_START_HOUR) * 60 + date.getMinutes();
}

function getDateForGridOffset(day: Date, offsetMinutes: number) {
  const base = startOfDay(day);
  const totalMinutes = DAY_START_HOUR * 60 + offsetMinutes;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const nextDate = new Date(base);
  nextDate.setHours(hours, minutes, 0, 0);
  return nextDate;
}

function getPointerMinutesFromGrid(pointerY: number, top: number, plannerHeight: number) {
  const relativeY = clamp(pointerY - top, 0, plannerHeight);
  const rawMinutes = (relativeY / plannerHeight) * GRID_TOTAL_MINUTES;
  return clamp(snapMinutes(rawMinutes), 0, GRID_TOTAL_MINUTES);
}

function getDayIndexFromPointer(pointerX: number, left: number, width: number, dayCount: number) {
  if (dayCount <= 1) {
    return 0;
  }

  const dayWidth = width / dayCount;
  return clamp(Math.floor((pointerX - left) / dayWidth), 0, dayCount - 1);
}

function getDayIndexForDate(days: Date[], target: Date) {
  return days.findIndex((day) => isSameDay(day, target));
}

function getEventVerticalLayout(start: Date, end: Date) {
  const startOffsetHours = getMinutesFromGridStart(start) / 60;
  const durationHours = Math.max(calculateDurationMinutes(start, end), MIN_BLOCK_MINUTES) / 60;

  return {
    top: startOffsetHours * HOUR_ROW_HEIGHT,
    height: Math.max(durationHours * HOUR_ROW_HEIGHT - 4, MIN_EVENT_HEIGHT),
  };
}

function getDraftLayout(start: Date, end: Date) {
  return getEventVerticalLayout(start, end);
}

function getDraftEditorPosition(
  dayIndex: number,
  blockTop: number,
  containerWidth: number,
  dayCount: number,
  plannerHeight: number
) {
  const editorWidth = 280;
  const gutter = 12;
  const safeDayCount = Math.max(dayCount, 1);
  const dayWidth = containerWidth / safeDayCount;
  const blockLeft = dayIndex * dayWidth + 8;
  const blockRight = blockLeft + Math.max(dayWidth - 16, 0);
  const left =
    blockRight + editorWidth + gutter <= containerWidth
      ? blockRight + gutter
      : Math.max(blockLeft - editorWidth - gutter, 8);

  return {
    left,
    top: clamp(blockTop, 8, Math.max(8, plannerHeight - 220)),
  };
}

function clampGridMinutes(minutes: number, durationMinutes: number) {
  return clamp(
    snapMinutes(minutes),
    0,
    Math.max(GRID_TOTAL_MINUTES - Math.max(durationMinutes, MIN_BLOCK_MINUTES), 0)
  );
}

function snapDateToGrid(date: Date) {
  const day = startOfDay(date);
  const gridOffset = clampGridMinutes(getMinutesFromGridStart(date), MIN_BLOCK_MINUTES);
  return getDateForGridOffset(day, gridOffset);
}

function ensureDraftEnd(start: Date, end: Date) {
  const safeDuration = Math.max(calculateDurationMinutes(start, end), MIN_BLOCK_MINUTES);
  const startOffset = getMinutesFromGridStart(start);
  const nextEndOffset = clamp(startOffset + safeDuration, startOffset + MIN_BLOCK_MINUTES, GRID_TOTAL_MINUTES);
  return getDateForGridOffset(start, nextEndOffset);
}

function shouldCreateNestedTaskBlock(
  data: TimeBlockFormValues,
  initialData?: Partial<TimeBlock> | null
) {
  const resolvedSource = data.source ?? initialData?.source ?? 'manual';
  return Boolean(data.taskId) && !initialData?.taskId && resolvedSource !== 'task';
}

function constrainTimeBlockRangeToParent(
  block: TimeBlock,
  start: Date,
  end: Date,
  blocks: TimeBlock[]
) {
  if (!block.parentBlockId) {
    return { start, end };
  }

  const parentBlock = blocks.find((item) => item.id === block.parentBlockId);
  if (!parentBlock) {
    return { start, end };
  }

  const durationMinutes = Math.min(
    Math.max(calculateDurationMinutes(start, end), MIN_BLOCK_MINUTES),
    Math.max(calculateDurationMinutes(parentBlock.start, parentBlock.end), MIN_BLOCK_MINUTES)
  );
  const parentStartOffset = getMinutesFromGridStart(parentBlock.start);
  const parentEndOffset = getMinutesFromGridStart(parentBlock.end);
  const nextStartOffset = clamp(
    getMinutesFromGridStart(start),
    parentStartOffset,
    Math.max(parentEndOffset - durationMinutes, parentStartOffset)
  );
  const nextStart = getDateForGridOffset(parentBlock.start, nextStartOffset);

  return {
    start: nextStart,
    end: add(nextStart, { minutes: durationMinutes }),
  };
}

function getSuggestedChildBlockRange(
  parentBlock: TimeBlock,
  siblingBlocks: TimeBlock[],
  preferredDurationMinutes: number
) {
  const parentDurationMinutes = Math.max(calculateDurationMinutes(parentBlock.start, parentBlock.end), MIN_BLOCK_MINUTES);
  const childDurationMinutes = clamp(
    preferredDurationMinutes,
    MIN_BLOCK_MINUTES,
    parentDurationMinutes
  );
  const orderedSiblings = [...siblingBlocks].sort(
    (left, right) => left.start.getTime() - right.start.getTime()
  );
  let cursor = new Date(parentBlock.start);

  for (const siblingBlock of orderedSiblings) {
    const gapMinutes = calculateDurationMinutes(cursor, siblingBlock.start);

    if (gapMinutes >= childDurationMinutes) {
      return {
        start: new Date(cursor),
        end: add(cursor, { minutes: childDurationMinutes }),
      };
    }

    if (siblingBlock.end.getTime() > cursor.getTime()) {
      cursor = new Date(siblingBlock.end);
    }
  }

  const trailingGapMinutes = calculateDurationMinutes(cursor, parentBlock.end);
  if (trailingGapMinutes >= MIN_BLOCK_MINUTES) {
    return {
      start: new Date(cursor),
      end: add(cursor, { minutes: Math.min(childDurationMinutes, trailingGapMinutes) }),
    };
  }

  return {
    start: new Date(parentBlock.start),
    end: add(parentBlock.start, { minutes: childDurationMinutes }),
  };
}

function buildChildTaskBlocksForParents(
  parentBlocks: TimeBlock[],
  taskId: string | undefined,
  tasks: Task[],
  existingBlocks: TimeBlock[],
  getCompensationDefaultsForCategory: (categoryId: string) => {
    hourlyRate?: number | null;
    currency?: string | null;
  }
) {
  if (!taskId) {
    return [];
  }

  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    return [];
  }

  const nextExistingBlocks = [...existingBlocks];
  const nextChildBlocks: TimeBlock[] = [];

  for (const parentBlock of parentBlocks) {
    if (!isTopLevelTimeBlock(parentBlock) || parentBlock.taskId || isProjectBoundaryBlock(parentBlock)) {
      continue;
    }

    const siblingBlocks = getChildTimeBlocks(nextExistingBlocks, parentBlock.id);
    if (siblingBlocks.some((block) => block.taskId === task.id)) {
      continue;
    }

    const childRange = getSuggestedChildBlockRange(
      parentBlock,
      siblingBlocks,
      task.estimatedMinutes ?? 60
    );
    const nextChildBlock = {
      ...buildTimeBlockFromFormValues(
        {
          title: task.title,
          description: task.description,
          categoryId: task.categoryId,
          tagIds: task.tagIds,
          taskId: task.id,
          start: childRange.start,
          end: childRange.end,
          plannedMinutes: calculateDurationMinutes(childRange.start, childRange.end),
          actualMinutes: 0,
          hourlyRate: undefined,
          currency: undefined,
          isRecurring: false,
          recurrenceDays: [],
          recurrenceEndType: 'onDate',
          recurrenceUntil: undefined,
          recurrenceCount: undefined,
          source: 'task',
          status: parentBlock.status === 'completed' ? 'completed' : 'scheduled',
          googleEventId: '',
          calendarId: '',
        },
        undefined,
        {
          compensationDefaults: getCompensationDefaultsForCategory(task.categoryId),
        }
      ),
      parentBlockId: parentBlock.id,
    };

    nextExistingBlocks.push(nextChildBlock);
    nextChildBlocks.push(nextChildBlock);
  }

  return nextChildBlocks;
}

type EventLayoutBounds = {
  left: number;
  width: number;
  zIndexBase: number;
  overlapPeek: number;
  gap: number;
  minWidth: number;
};

function getBoundedEventLayouts(blocks: TimeBlock[], bounds: EventLayoutBounds) {
  const layouts = new Map<TimeBlockId, CalendarEventLayout>();

  if (blocks.length === 0) {
    return layouts;
  }

  const orderedBlocks = [...blocks].sort((left, right) => {
    const startDiff = left.start.getTime() - right.start.getTime();
    if (startDiff !== 0) {
      return startDiff;
    }

    const leftDuration = calculateDurationMinutes(left.start, left.end);
    const rightDuration = calculateDurationMinutes(right.start, right.end);
    if (leftDuration !== rightDuration) {
      return rightDuration - leftDuration;
    }

    return left.title.localeCompare(right.title);
  });

  const clusters: Array<
    Array<{
      block: TimeBlock;
      column: number;
      order: number;
      startMinutes: number;
      endMinutes: number;
      span: number;
      totalColumns: number;
    }>
  > = [];
  let currentCluster: Array<{
    block: TimeBlock;
    column: number;
    order: number;
    startMinutes: number;
    endMinutes: number;
    span: number;
    totalColumns: number;
  }> = [];
  let currentClusterEnd = -1;

  orderedBlocks.forEach((block, order) => {
    const startMinutes = getMinutesFromGridStart(block.start);
    const endMinutes = getMinutesFromGridStart(block.end);
    const nextItem = {
      block,
      column: 0,
      order,
      startMinutes,
      endMinutes,
      span: 1,
      totalColumns: 1,
    };

    if (currentCluster.length === 0 || startMinutes < currentClusterEnd) {
      currentCluster.push(nextItem);
      currentClusterEnd = Math.max(currentClusterEnd, endMinutes);
      return;
    }

    clusters.push(currentCluster);
    currentCluster = [nextItem];
    currentClusterEnd = endMinutes;
  });

  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  clusters.forEach((cluster) => {
    const columnEndTimes: number[] = [];

    cluster.forEach((item) => {
      let nextColumn = columnEndTimes.findIndex((endMinutes) => item.startMinutes >= endMinutes);
      if (nextColumn === -1) {
        nextColumn = columnEndTimes.length;
        columnEndTimes.push(item.endMinutes);
      } else {
        columnEndTimes[nextColumn] = item.endMinutes;
      }

      item.column = nextColumn;
    });

    const totalColumns = Math.max(columnEndTimes.length, 1);

    cluster.forEach((item) => {
      item.totalColumns = totalColumns;

      while (item.column + item.span < totalColumns) {
        const nextColumn = item.column + item.span;
        const overlapsOnNextColumn = cluster.some(
          (other) =>
            other !== item &&
            other.column === nextColumn &&
            item.startMinutes < other.endMinutes &&
            item.endMinutes > other.startMinutes
        );

        if (overlapsOnNextColumn) {
          break;
        }

        item.span += 1;
      }

      const vertical = getEventVerticalLayout(item.block.start, item.block.end);
      const availableWidth = Math.max(bounds.width, bounds.minWidth);
      const baseColumnWidth = availableWidth / totalColumns;
      const peek =
        totalColumns > 1
          ? Math.min(bounds.overlapPeek, Math.max(6, availableWidth * 0.08))
          : 0;
      let left = bounds.left + item.column * baseColumnWidth;
      let width = item.span * baseColumnWidth;

      if (item.column > 0) {
        left -= peek;
      }

      if (item.column + item.span < totalColumns) {
        width += peek;
      }

      width = Math.max(width - (totalColumns > 1 ? bounds.gap : 0), bounds.minWidth);
      if (left + width > bounds.left + availableWidth) {
        const maxWidth = Math.max(bounds.left + availableWidth - left, bounds.minWidth);
        width = Math.max(Math.min(width, maxWidth), Math.min(bounds.minWidth, maxWidth));
      }

      layouts.set(item.block.id, {
        ...vertical,
        left,
        width,
        zIndex: bounds.zIndexBase + item.column + item.order,
        columns: totalColumns,
        span: item.span,
      });
    });
  });

  return layouts;
}

function getFullWidthEventLayout(block: TimeBlock, dayWidth: number): CalendarEventLayout {
  const vertical = getEventVerticalLayout(block.start, block.end);
  const safeDayWidth = Math.max(dayWidth, 140);
  const width = Math.max(safeDayWidth - PLANNER_EVENT_SIDE_PADDING * 2, 56);

  return {
    ...vertical,
    left: PLANNER_EVENT_SIDE_PADDING,
    width,
    zIndex: 10,
    columns: 1,
    span: 1,
  };
}

function getDayEventLayouts(blocks: TimeBlock[], dayWidth: number) {
  const safeDayWidth = Math.max(dayWidth, 140);

  return getBoundedEventLayouts(blocks, {
    left: PLANNER_EVENT_SIDE_PADDING,
    width: Math.max(safeDayWidth - PLANNER_EVENT_SIDE_PADDING * 2, 56),
    zIndexBase: 10,
    overlapPeek: PLANNER_EVENT_OVERLAP_PEEK,
    gap: PLANNER_EVENT_GAP,
    minWidth: 56,
  });
}

function getNestedEventLayouts(blocks: TimeBlock[], parentLayout: CalendarEventLayout) {
  return getBoundedEventLayouts(blocks, {
    left: parentLayout.left + 10,
    width: Math.max(parentLayout.width - 18, 32),
    zIndexBase: parentLayout.zIndex + 20,
    overlapPeek: 8,
    gap: 2,
    minWidth: 28,
  });
}

function getNestedFallbackEventLayout(
  block: TimeBlock,
  parentLayout: CalendarEventLayout
): CalendarEventLayout {
  const vertical = getEventVerticalLayout(block.start, block.end);

  return {
    ...vertical,
    left: parentLayout.left + 10,
    width: Math.max(parentLayout.width - 18, 32),
    zIndex: parentLayout.zIndex + 20,
    columns: 1,
    span: 1,
  };
}

function formatTaskDue(date: Date) {
  const today = new Date();
  const tomorrow = add(startOfDay(today), { days: 1 });

  if (isSameDay(date, today)) {
    return 'Due today';
  }

  if (isSameDay(date, tomorrow)) {
    return 'Due tomorrow';
  }

  return `Due ${format(date, 'EEE')}`;
}

function formatStatus(status: TimeBlock['status']) {
  if (status === 'in-progress') {
    return 'In progress';
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusClasses(status: TimeBlock['status']) {
  if (status === 'completed') {
    return 'rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-[9px] text-emerald-700';
  }

  if (status === 'in-progress') {
    return 'rounded-full bg-blue-100 px-1.5 py-0.5 font-medium text-[9px] text-blue-700';
  }

  if (status === 'cancelled') {
    return 'rounded-full bg-rose-100 px-1.5 py-0.5 font-medium text-[9px] text-rose-700';
  }

  return 'rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-[9px] text-slate-600';
}

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getLineClampStyle(lines: number) {
  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical' as const,
    WebkitLineClamp: lines,
    overflow: 'hidden',
  };
}

function getEventTitleStyle(height: number, title: string) {
  let fontSize = 12;

  if (height < 72) {
    fontSize = 10;
  } else if (height < 110) {
    fontSize = 11;
  }

  if (title.length > 34) {
    fontSize -= 1;
  }

  if (title.length > 56) {
    fontSize -= 1;
  }

  return {
    fontSize: `${Math.max(fontSize, 9)}px`,
    lineHeight: 1.15,
    wordBreak: 'break-word' as const,
    overflowWrap: 'anywhere' as const,
  };
}

function getCalendarViewConfig(currentDate: Date, viewMode: CalendarViewMode) {
  if (viewMode === 'day') {
    const rangeStart = startOfDay(currentDate);
    const rangeEnd = endOfDay(currentDate);

    return {
      rangeStart,
      rangeEnd,
      gridStart: undefined,
      gridEnd: undefined,
      heroBadge: 'Day view for detailed execution',
      metricLabel: 'Day scheduled',
      focusTitle: 'Focus Day',
      resetLabel: 'Today',
      rangeLabel: format(currentDate, 'EEEE, MMMM d, yyyy'),
    };
  }

  if (viewMode === 'month') {
    const rangeStart = startOfMonth(currentDate);
    const rangeEnd = endOfMonth(currentDate);

    return {
      rangeStart,
      rangeEnd,
      gridStart: startOfWeek(rangeStart, { weekStartsOn: WEEK_STARTS_ON }),
      gridEnd: endOfWeek(rangeEnd, { weekStartsOn: WEEK_STARTS_ON }),
      heroBadge: 'Month view for longer-range scanning',
      metricLabel: 'Month scheduled',
      focusTitle: 'Focus Month',
      resetLabel: 'This month',
      rangeLabel: format(currentDate, 'MMMM yyyy'),
    };
  }

  const rangeStart = startOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON });
  const rangeEnd = endOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON });

  return {
    rangeStart,
    rangeEnd,
    gridStart: undefined,
    gridEnd: undefined,
    heroBadge: 'Week view is the primary planning surface',
    metricLabel: 'Week scheduled',
    focusTitle: 'Focus Week',
    resetLabel: 'This week',
    rangeLabel: `${format(rangeStart, 'MMMM d')} to ${format(rangeEnd, 'MMMM d, yyyy')}`,
  };
}
