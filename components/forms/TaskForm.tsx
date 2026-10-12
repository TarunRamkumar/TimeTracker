'use client';

import { useEffect } from 'react';
import { format } from 'date-fns';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Category, Project, Tag, Task, TaskProgressEntry, TimeBlock } from '@/lib/domain/types';
import { DEFAULT_CATEGORIES } from '@/lib/domain/constants';
import { formatMinutes, getCategoryPathLabel } from '@/lib/domain/helpers';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Select,
  TextArea,
} from '@/components/ui';
import { getTaskFormDefaults } from '@/lib/forms/defaults';
import {
  taskFormSchema,
  type TaskFormInput,
  type TaskFormValues,
} from '@/lib/forms/schemas';

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'create' | 'edit';
  initialData?: Partial<Task> | null;
  categories?: Category[];
  projects?: Project[];
  tags?: Tag[];
  timeBlocks?: TimeBlock[];
  onSubmit: (data: TaskFormValues) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  isLoading?: boolean;
}

export function TaskForm({
  open,
  onOpenChange,
  mode = 'create',
  initialData,
  categories = DEFAULT_CATEGORIES,
  projects = [],
  tags = [],
  timeBlocks = [],
  onSubmit,
  onDelete,
  isLoading = false,
}: TaskFormProps) {
  const defaults = getTaskFormDefaults(initialData);
  const linkedBlock = initialData?.calendarBlockId
    ? timeBlocks.find((block) => block.id === initialData.calendarBlockId)
    : undefined;
  const sortedProgressEntries = [...(initialData?.progressEntries ?? [])].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
  );
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<TaskFormInput, unknown, TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: defaults,
  });

  const selectedTagIds = useWatch({
    control,
    name: 'tagIds',
  }) ?? [];
  const selectedProjectId = useWatch({
    control,
    name: 'projectId',
  });
  const selectedCategoryId = useWatch({
    control,
    name: 'categoryId',
  });
  const selectedProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId)
    : undefined;
  const inheritedCategoryLabel = selectedProject
    ? getCategoryPathLabel(categories, selectedProject.categoryId)
    : '';

  useEffect(() => {
    reset(getTaskFormDefaults(initialData));
  }, [initialData, open, reset]);

  useEffect(() => {
    if (!selectedProject || selectedCategoryId === selectedProject.categoryId) {
      return;
    }

    setValue('categoryId', selectedProject.categoryId, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [selectedCategoryId, selectedProject, setValue]);

  const handleTagToggle = (tagId: string) => {
    const nextValues = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((currentId) => currentId !== tagId)
      : [...selectedTagIds, tagId];

    setValue('tagIds', nextValues, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleClose = () => {
    reset(getTaskFormDefaults(initialData));
    onOpenChange(false);
  };

  const handleFormSubmit = handleSubmit(async (data) => {
    await onSubmit(data);
    handleClose();
  });

  const handleDelete = async () => {
    if (!onDelete) {
      return;
    }

    if (!window.confirm('Delete this task? This cannot be undone.')) {
      return;
    }

    await onDelete();
    handleClose();
  };

  const getProgressEntryTimestamp = (entry: TaskProgressEntry) => {
    const primaryTimestamp = entry.startedAt ?? entry.createdAt;
    return format(primaryTimestamp, 'MMM d, h:mm a');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative max-w-2xl">
        <DialogClose onClick={handleClose} />
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Task' : 'Create Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleFormSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <FormField label="Title" error={errors.title?.message} required>
              <Input placeholder="Design dashboard hierarchy" {...register('title')} />
            </FormField>

            <FormField label="Project" error={errors.projectId?.message}>
              <Select
                options={[
                  { value: '', label: 'No project' },
                  ...projects.map((project) => ({ value: project.id, label: project.name })),
                ]}
                {...register('projectId')}
              />
            </FormField>
          </div>

          <FormField label="Description" error={errors.description?.message}>
            <TextArea
              placeholder="Write down what done looks like and how this connects to the week."
              {...register('description')}
            />
          </FormField>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Status" error={errors.status?.message} required>
              <Select
                options={[
                  { value: 'inbox', label: 'Inbox' },
                  { value: 'next', label: 'Next' },
                  { value: 'doing', label: 'Doing' },
                  { value: 'waiting', label: 'Waiting' },
                  { value: 'done', label: 'Done' },
                ]}
                {...register('status')}
              />
            </FormField>

            <FormField label="Priority" error={errors.priority?.message} required>
              <Select
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
                {...register('priority')}
              />
            </FormField>

            <FormField label="Category" error={errors.categoryId?.message} required>
              {selectedProject ? (
                <>
                  <input type="hidden" {...register('categoryId')} />
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">
                      {inheritedCategoryLabel || selectedProject.name}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Inherited from {selectedProject.name}. Move the task out of the project to
                      choose a standalone category.
                    </p>
                  </div>
                </>
              ) : (
                <Select
                  options={[
                    { value: '', label: 'Select category' },
                    ...categories.map((category) => ({
                      value: category.id,
                      label: getCategoryPathLabel(categories, category.id) || category.name,
                    })),
                  ]}
                  {...register('categoryId')}
                />
              )}
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Estimate (minutes)" error={errors.estimatedMinutes?.message}>
              <Input type="number" min="0" step="1" placeholder="90" {...register('estimatedMinutes')} />
            </FormField>

            <FormField label="Due date" error={errors.dueDate?.message}>
              <Input type="date" {...register('dueDate')} />
            </FormField>
            {mode === 'edit' ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Work summary
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Time spent</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatMinutes(initialData?.actualMinutes ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Calendar</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {linkedBlock
                        ? `${format(linkedBlock.start, 'EEE h:mm a')} - ${format(linkedBlock.end, 'h:mm a')}`
                        : 'Not scheduled yet'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Schedule and tracked time are managed from the calendar and timer controls so the
                  task stays lightweight here.
                </p>
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

          {mode === 'edit' ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">Work log</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Session notes and progress recaps from linked calendar blocks show up here automatically.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {sortedProgressEntries.length}{' '}
                  {sortedProgressEntries.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              {sortedProgressEntries.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {sortedProgressEntries.map((entry, index) => {
                    const relatedBlock = entry.timeBlockId
                      ? timeBlocks.find((block) => block.id === entry.timeBlockId)
                      : undefined;

                    return (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              Session {sortedProgressEntries.length - index}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {getProgressEntryTimestamp(entry)}
                              {relatedBlock ? ` · ${relatedBlock.title}` : ''}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                            {formatMinutes(entry.durationMinutes)}
                          </span>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-slate-700">
                          {entry.note.trim().length > 0
                            ? entry.note
                            : 'No note yet. Add one from the calendar block when you want to capture what you worked on.'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                  No work log yet. Start a timer or add a note from a linked calendar block to build progress history.
                </div>
              )}
            </div>
          ) : null}

          <div
            className={`flex gap-3 border-t border-slate-200 pt-4 ${
              mode === 'edit' && onDelete ? 'justify-between' : 'justify-end'
            }`}
          >
            {mode === 'edit' && onDelete ? (
              <Button variant="danger" onClick={handleDelete} disabled={isLoading}>
                Delete Task
              </Button>
            ) : null}
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : mode === 'edit' ? 'Update Task' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
