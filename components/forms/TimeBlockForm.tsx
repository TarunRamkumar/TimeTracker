'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type {
  Category,
  RecurringDeleteScope,
  RecurringEditScope,
  Tag,
  Task,
  TimeBlock,
} from '@/lib/domain/types';
import { DEFAULT_CATEGORIES } from '@/lib/domain/constants';
import {
  calculateTimeBlockEarnings,
  calculateDurationMinutes,
  formatCurrency,
  formatMinutes,
  formatRecurrenceSummary,
  getCalendarItemLabel,
  getTimeBlockActualMinutes,
  isCompletedCalendarEvent,
  resolveTimeBlockCurrency,
  resolveTimeBlockHourlyRate,
} from '@/lib/domain/helpers';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Select,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  TextArea,
} from '@/components/ui';
import { getTimeBlockFormDefaults } from '@/lib/forms/defaults';
import {
  timeBlockFormSchema,
  type TimeBlockFormInput,
  type TimeBlockFormValues,
} from '@/lib/forms/schemas';

const WEEKDAY_OPTIONS = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '0', label: 'Sun' },
] as const;

const CURRENCY_OPTIONS = [
  { value: '', label: 'Use category / USD' },
  { value: 'USD', label: 'USD' },
  { value: 'CAD', label: 'CAD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
];

type WeekdayValue = (typeof WEEKDAY_OPTIONS)[number]['value'];

interface TimeBlockFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'create' | 'edit';
  initialData?: Partial<TimeBlock> | null;
  categories?: Category[];
  tags?: Tag[];
  tasks?: Task[];
  onSubmit: (data: TimeBlockFormValues, scope?: RecurringEditScope) => void | Promise<void>;
  onDelete?: (scope?: RecurringDeleteScope) => void | Promise<void>;
  onAddNote?: (input: {
    content: string;
    durationMinutes?: number;
    kind?: TimeBlock['notes'][number]['kind'];
  }) => void | Promise<void>;
  isLoading?: boolean;
  taskActionPanel?: ReactNode;
}

export function TimeBlockForm({
  open,
  onOpenChange,
  mode = 'create',
  initialData,
  categories = DEFAULT_CATEGORIES,
  tags = [],
  tasks = [],
  onSubmit,
  onDelete,
  onAddNote,
  isLoading = false,
  taskActionPanel,
}: TimeBlockFormProps) {
  const defaults = getTimeBlockFormDefaults(initialData);
  const [pendingSubmitData, setPendingSubmitData] = useState<TimeBlockFormValues | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [compensationVisibilityOverride, setCompensationVisibilityOverride] = useState<boolean | null>(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<TimeBlockFormInput, unknown, TimeBlockFormValues>({
    resolver: zodResolver(timeBlockFormSchema),
    defaultValues: defaults,
  });

  const selectedTagIds = useWatch({
    control,
    name: 'tagIds',
  }) ?? [];
  const watchedStart = useWatch({
    control,
    name: 'start',
  });
  const watchedEnd = useWatch({
    control,
    name: 'end',
  });
  const watchedTaskId = useWatch({
    control,
    name: 'taskId',
  });
  const watchedCategoryId = useWatch({
    control,
    name: 'categoryId',
  });
  const watchedActualMinutes = useWatch({
    control,
    name: 'actualMinutes',
  });
  const watchedHourlyRate = useWatch({
    control,
    name: 'hourlyRate',
  });
  const watchedCurrency = useWatch({
    control,
    name: 'currency',
  });
  const isRecurringEnabled = useWatch({
    control,
    name: 'isRecurring',
  });
  const recurrenceDays = useWatch({
    control,
    name: 'recurrenceDays',
  }) ?? [];
  const recurrenceEndType = useWatch({
    control,
    name: 'recurrenceEndType',
  });
  const parsedWatchedStart =
    typeof watchedStart === 'string' || watchedStart instanceof Date
      ? new Date(watchedStart)
      : undefined;
  const parsedWatchedEnd =
    typeof watchedEnd === 'string' || watchedEnd instanceof Date
      ? new Date(watchedEnd)
      : undefined;
  const liveDurationMinutes =
    parsedWatchedStart &&
    parsedWatchedEnd &&
    !Number.isNaN(parsedWatchedStart.getTime()) &&
    !Number.isNaN(parsedWatchedEnd.getTime())
      ? Math.max(calculateDurationMinutes(parsedWatchedStart, parsedWatchedEnd), 1)
      : undefined;
  const isRecurringSeriesEvent = Boolean(initialData?.recurrence?.seriesId);
  const selectedCategory = categories.find((category) => category.id === watchedCategoryId);
  const compensationAvailableFromCategory =
    typeof selectedCategory?.hourlyRate === 'number' && selectedCategory.hourlyRate >= 0;
  const showCompensation =
    compensationVisibilityOverride ??
    Boolean(initialData?.hourlyRate || initialData?.currency || compensationAvailableFromCategory);
  const normalizedWatchedCurrency = typeof watchedCurrency === 'string' ? watchedCurrency : null;
  const parsedActualMinutes =
    typeof watchedActualMinutes === 'number'
      ? watchedActualMinutes
      : typeof watchedActualMinutes === 'string' && watchedActualMinutes.trim() !== ''
        ? Number(watchedActualMinutes)
        : undefined;
  const parsedHourlyRate =
    typeof watchedHourlyRate === 'number'
      ? watchedHourlyRate
      : typeof watchedHourlyRate === 'string' && watchedHourlyRate.trim() !== ''
        ? Number(watchedHourlyRate)
        : undefined;
  const compensationPreviewBlock = {
    actualMinutes: parsedActualMinutes ?? initialData?.actualMinutes ?? 0,
    start: parsedWatchedStart ?? initialData?.start ?? new Date(),
    end:
      parsedWatchedEnd ??
      initialData?.end ??
      new Date((parsedWatchedStart ?? initialData?.start ?? new Date()).getTime() + 60 * 60 * 1000),
    hourlyRate: Number.isFinite(parsedHourlyRate) ? parsedHourlyRate : null,
    currency: normalizedWatchedCurrency,
  };
  const resolvedHourlyRate = resolveTimeBlockHourlyRate(compensationPreviewBlock, selectedCategory);
  const resolvedCurrency = resolveTimeBlockCurrency(compensationPreviewBlock, selectedCategory);
  const earningsPreview = calculateTimeBlockEarnings(compensationPreviewBlock, selectedCategory);
  const usesCategoryCompensation =
    resolvedHourlyRate !== null &&
    !Number.isFinite(parsedHourlyRate) &&
    typeof selectedCategory?.hourlyRate === 'number';

  useEffect(() => {
    reset(getTimeBlockFormDefaults(initialData));
  }, [initialData, open, reset]);

  const handleTagToggle = (tagId: string) => {
    const nextValues = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((currentId) => currentId !== tagId)
      : [...selectedTagIds, tagId];

    setValue('tagIds', nextValues, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleWeekdayToggle = (day: WeekdayValue) => {
    const nextDays = recurrenceDays.includes(day)
      ? recurrenceDays.filter((currentDay) => currentDay !== day)
      : [...recurrenceDays, day];

    setValue('recurrenceDays', nextDays, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleClose = () => {
    setPendingSubmitData(null);
    setSaveDialogOpen(false);
    setDeleteDialogOpen(false);
    setCompensationVisibilityOverride(null);
    reset(getTimeBlockFormDefaults(initialData));
    onOpenChange(false);
  };

  const confirmSubmit = async (
    data: TimeBlockFormValues,
    scope: RecurringEditScope = 'single'
  ) => {
    await onSubmit(data, scope);
    setPendingSubmitData(null);
    setSaveDialogOpen(false);
    handleClose();
  };

  const handleFormSubmit = handleSubmit(async (data) => {
    if (mode === 'edit' && isRecurringSeriesEvent) {
      setPendingSubmitData(data);
      setSaveDialogOpen(true);
      return;
    }

    await confirmSubmit(data, 'single');
  });

  const confirmDelete = async (scope: RecurringDeleteScope = 'single') => {
    if (!onDelete) {
      return;
    }

    await onDelete(scope);
    setDeleteDialogOpen(false);
    handleClose();
  };

  const handleDelete = async () => {
    if (!onDelete) {
      return;
    }

    if (isRecurringSeriesEvent) {
      setDeleteDialogOpen(true);
      return;
    }

    if (!window.confirm('Delete this calendar event? This cannot be undone.')) {
      return;
    }

    await confirmDelete('single');
  };

  const plannedMinutes = liveDurationMinutes ?? initialData?.plannedMinutes ?? 60;
  const isCompletedNonTaskEvent = Boolean(
    initialData && isCompletedCalendarEvent(initialData as TimeBlock)
  );
  const effectiveActualMinutes = initialData
    ? getTimeBlockActualMinutes(initialData as TimeBlock)
    : liveDurationMinutes ?? 0;
  const linkedTask = watchedTaskId
    ? tasks.find((task) => task.id === watchedTaskId)
    : undefined;
  const taskFieldLabel = initialData?.taskId ? 'Task for this block' : 'Add task inside this event';
  const panelLabel = initialData ? getCalendarItemLabel(initialData as TimeBlock) : 'Calendar event';
  const recurrenceSummary = formatRecurrenceSummary(initialData?.recurrence);
  const recurringRegistration = register('isRecurring');
  const sortedNotes = [...(initialData?.notes ?? [])].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {mode === 'edit'
              ? initialData?.taskId
                ? 'Calendar Task Block'
                : 'Calendar Event'
              : initialData?.taskId
                ? 'Create Calendar Task Block'
                : 'Create Calendar Event'}
          </SheetTitle>
        </SheetHeader>

        <SheetBody>
          <form id="time-block-form" onSubmit={handleFormSubmit} className="space-y-5">
            {mode === 'edit' ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      {panelLabel}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {initialData?.start && initialData?.end
                        ? `${format(initialData.start, 'EEE h:mm a')} - ${format(initialData.end, 'h:mm a')}`
                        : 'No time set yet'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">
                      {isCompletedNonTaskEvent ? 'Recorded time' : 'Current duration'}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatMinutes(
                        isCompletedNonTaskEvent ? effectiveActualMinutes : plannedMinutes
                      )}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {isCompletedNonTaskEvent
                    ? 'Past calendar events automatically switch over to recorded time once they end.'
                    : 'Editing the calendar duration keeps the block simple in the UI while tracked time stays available for analytics.'}
                </p>
              </div>
            ) : null}

            {taskActionPanel ? <div>{taskActionPanel}</div> : null}

            <FormField label="Title" error={errors.title?.message} required>
              <Input
                placeholder={linkedTask ? linkedTask.title : 'Focus sprint for dashboard polish'}
                {...register('title')}
              />
            </FormField>

            <FormField label="Description" error={errors.description?.message}>
              <TextArea
                placeholder="Describe what happens during this block and why it matters."
                {...register('description')}
              />
            </FormField>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Category" error={errors.categoryId?.message} required>
                <Select
                  options={[
                    { value: '', label: 'Select category' },
                    ...categories.map((category) => ({
                      value: category.id,
                      label: category.name,
                    })),
                  ]}
                  {...register('categoryId')}
                />
              </FormField>

              <FormField label={taskFieldLabel} error={errors.taskId?.message}>
                <Select
                  options={[
                    { value: '', label: 'None' },
                    ...tasks.map((task) => ({
                      value: task.id,
                      label: task.title,
                    })),
                  ]}
                  {...register('taskId')}
                />
                {!initialData?.taskId ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Selecting a task here adds a draggable task segment inside this event instead
                    of replacing the event itself.
                  </p>
                ) : null}
                {Boolean(isRecurringEnabled) || isRecurringSeriesEvent ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Task links follow the same recurring save scope you choose for this series.
                  </p>
                ) : null}
              </FormField>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Starts" error={errors.start?.message} required>
                <Input type="datetime-local" {...register('start')} />
              </FormField>

              <FormField label="Ends" error={errors.end?.message} required>
                <Input type="datetime-local" {...register('end')} />
              </FormField>
            </div>

            <FormField label="Repeat">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                {isRecurringSeriesEvent ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">Recurring series</p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        Active
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {recurrenceSummary ?? 'This event belongs to a repeating series.'}
                    </p>
                    <p className="text-xs leading-5 text-slate-500">
                      Saving changes lets you choose whether they apply to this event, this and
                      following events, or the full series.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Make this repeat</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Choose the weekdays and when the series should stop, similar to Google
                          Calendar&apos;s custom repeat flow.
                        </p>
                      </div>
                      <Checkbox
                        checked={Boolean(isRecurringEnabled)}
                        {...recurringRegistration}
                        onChange={recurringRegistration.onChange}
                      />
                    </div>

                    {isRecurringEnabled ? (
                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                            Repeat on
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {WEEKDAY_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => handleWeekdayToggle(option.value)}
                                className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                                  recurrenceDays.includes(option.value)
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          {errors.recurrenceDays?.message ? (
                            <p className="mt-2 text-xs text-red-600">{errors.recurrenceDays.message}</p>
                          ) : null}
                        </div>

                        <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                          <FormField label="Ends" error={errors.recurrenceEndType?.message}>
                            <Select
                              options={[
                                { value: 'onDate', label: 'On date' },
                                { value: 'afterOccurrences', label: 'After number of events' },
                              ]}
                              {...register('recurrenceEndType')}
                            />
                          </FormField>

                          {recurrenceEndType === 'afterOccurrences' ? (
                            <FormField label="Events" error={errors.recurrenceCount?.message}>
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                placeholder="5"
                                {...register('recurrenceCount')}
                              />
                            </FormField>
                          ) : (
                            <FormField label="End date" error={errors.recurrenceUntil?.message}>
                              <Input type="date" {...register('recurrenceUntil')} />
                            </FormField>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </FormField>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  {isCompletedNonTaskEvent ? 'Recorded' : 'Current duration'}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {formatMinutes(
                    isCompletedNonTaskEvent
                      ? effectiveActualMinutes
                      : mode === 'create' && liveDurationMinutes
                      ? liveDurationMinutes
                      : plannedMinutes
                  )}
                </p>
              </div>

              <FormField label="Time spent (minutes)" error={errors.actualMinutes?.message}>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  {...register('actualMinutes')}
                />
              </FormField>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">Compensation</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Optional. Keep this blank for unpaid events, or add a rate for blocks that
                    earn money.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCompensationVisibilityOverride((current) => !(current ?? showCompensation))
                  }
                  className="rounded-full border border-slate-200 bg-white text-slate-700"
                >
                  {showCompensation ? 'Hide' : compensationAvailableFromCategory ? 'View compensation' : 'Add compensation'}
                </Button>
              </div>

              {showCompensation ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-[1fr_200px]">
                    <FormField label="Hourly rate" error={errors.hourlyRate?.message}>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={
                          typeof selectedCategory?.hourlyRate === 'number'
                            ? `${selectedCategory.hourlyRate}`
                            : '25'
                        }
                        {...register('hourlyRate')}
                      />
                    </FormField>

                    <FormField label="Currency" error={errors.currency?.message}>
                      <Select options={CURRENCY_OPTIONS} {...register('currency')} />
                    </FormField>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Earnings at current duration
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {earningsPreview !== null
                        ? formatCurrency(earningsPreview, resolvedCurrency)
                        : 'No rate set'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {resolvedHourlyRate !== null
                        ? `${formatCurrency(resolvedHourlyRate, resolvedCurrency)} / hr • ${formatMinutes(
                            parsedActualMinutes && parsedActualMinutes > 0
                              ? parsedActualMinutes
                              : liveDurationMinutes ?? plannedMinutes
                          )}`
                        : typeof selectedCategory?.hourlyRate === 'number'
                          ? `Uses ${selectedCategory.name}'s default rate when left blank.`
                          : 'Add a rate here or set one on the category to enable earnings.'}
                    </p>
                    {usesCategoryCompensation ? (
                      <p className="mt-2 text-xs font-medium text-slate-600">
                        Inheriting {formatCurrency(selectedCategory?.hourlyRate ?? 0, selectedCategory?.currency)} / hr
                        {' '}from {selectedCategory?.name ?? 'the category'}.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <FormField label="Tags" error={errors.tagIds?.message as string | undefined}>
              <div className="grid gap-2 sm:grid-cols-2">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors ${
                      selectedTagIds.includes(tag.id)
                        ? 'border-slate-900 bg-slate-50 text-slate-900'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(tag.id)}
                      onChange={() => handleTagToggle(tag.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span>{tag.name}</span>
                  </label>
                ))}
              </div>
            </FormField>

            {mode === 'edit' && initialData ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Notes & recap</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {initialData.taskId
                        ? 'Use this to capture what you worked on. Notes here also appear in the task’s work log.'
                        : 'Use this to capture a recap, summary, or quick memory of what happened in this event.'}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {sortedNotes.length} {sortedNotes.length === 1 ? 'note' : 'notes'}
                  </span>
                </div>

                {onAddNote ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <TimeBlockNoteComposer
                      key={initialData.id ?? `${initialData.start?.toISOString() ?? 'draft'}-notes`}
                      taskLinked={Boolean(initialData.taskId)}
                      onAddNote={onAddNote}
                    />
                  </div>
                ) : null}

                {sortedNotes.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {sortedNotes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                              {note.kind === 'recap' ? 'Recap' : 'Progress note'}
                            </span>
                            <span className="text-xs text-slate-500">
                              {format(note.createdAt, 'MMM d, h:mm a')}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-slate-600">
                            {formatMinutes(note.durationMinutes)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{note.content}</p>
                        {note.taskProgressEntryId ? (
                          <p className="mt-2 text-xs text-slate-500">
                            Added to the linked task&apos;s work log.
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                    No notes yet. Add a quick progress note or recap here after the session.
                  </div>
                )}
              </div>
            ) : null}
          </form>
        </SheetBody>

        <SheetFooter className={mode === 'edit' && onDelete ? 'justify-between' : 'justify-end'}>
          {mode === 'edit' && onDelete ? (
            <Button variant="danger" onClick={handleDelete} disabled={isLoading}>
              Delete event
            </Button>
          ) : null}
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button form="time-block-form" type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Create event'}
          </Button>
        </SheetFooter>
      </SheetContent>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete repeating event?</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm leading-6 text-slate-600">
              Choose how much of this series to remove. This only affects the repeating event you
              are editing now.
            </p>

            <button
              type="button"
              onClick={() => void confirmDelete('single')}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-slate-900">Delete this event</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Remove only this occurrence and keep the rest of the series.
              </p>
            </button>

            <button
              type="button"
              onClick={() => void confirmDelete('following')}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-slate-900">Delete this and following events</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Keep earlier events, but remove this occurrence and everything after it.
              </p>
            </button>

            <button
              type="button"
              onClick={() => void confirmDelete('all')}
              className="w-full rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3 text-left transition-colors hover:border-red-300 hover:bg-red-50"
            >
              <p className="text-sm font-medium text-red-700">Delete all events in the series</p>
              <p className="mt-1 text-xs leading-5 text-red-600/80">
                Remove every event that belongs to this repeating series.
              </p>
            </button>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply changes to repeating event?</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm leading-6 text-slate-600">
              Choose how widely these edits should apply across the repeating event.
            </p>

            <button
              type="button"
              onClick={() => {
                if (pendingSubmitData) {
                  void confirmSubmit(pendingSubmitData, 'single');
                }
              }}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-slate-900">Save just this event</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Keep the rest of the series unchanged.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                if (pendingSubmitData) {
                  void confirmSubmit(pendingSubmitData, 'following');
                }
              }}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-slate-900">Save this and following events</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Split the series here and apply the edits from this point forward.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                if (pendingSubmitData) {
                  void confirmSubmit(pendingSubmitData, 'all');
                }
              }}
              className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
            >
              <p className="text-sm font-medium text-slate-900">Save all events in the series</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Update every occurrence in this repeating set.
              </p>
            </button>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setPendingSubmitData(null);
                setSaveDialogOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

function TimeBlockNoteComposer({
  taskLinked,
  onAddNote,
}: {
  taskLinked: boolean;
  onAddNote: (input: {
    content: string;
    durationMinutes?: number;
    kind?: TimeBlock['notes'][number]['kind'];
  }) => void | Promise<void>;
}) {
  const [noteDraft, setNoteDraft] = useState('');
  const [noteKind, setNoteKind] = useState<TimeBlock['notes'][number]['kind']>(
    taskLinked ? 'work-note' : 'recap'
  );

  const handleNoteSubmit = async () => {
    const content = noteDraft.trim();
    if (!content) {
      return;
    }

    await onAddNote({
      content,
      kind: noteKind,
    });
    setNoteDraft('');
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-[180px_1fr]">
        <FormField label="Note type">
          <Select
            value={noteKind}
            onChange={(event) =>
              setNoteKind(event.target.value as TimeBlock['notes'][number]['kind'])
            }
            options={[
              { value: 'work-note', label: 'Progress note' },
              { value: 'recap', label: 'Recap' },
            ]}
          />
        </FormField>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Note
          </label>
          <TextArea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder={
              taskLinked
                ? 'Worked on the recurring edit flow and cleaned up provider state.'
                : 'Good lifting session. Increased volume and felt strong on the final set.'
            }
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void handleNoteSubmit()}
          disabled={noteDraft.trim().length === 0}
        >
          Add note
        </Button>
      </div>
    </>
  );
}
