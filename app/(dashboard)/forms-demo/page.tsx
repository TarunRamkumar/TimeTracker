'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CategoryForm, TaskForm, TimeBlockForm } from '@/components/forms';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { PageShell } from '@/components/layout/PageShell';
import { useCategoryForm, useTaskForm, useTimeBlockForm } from '@/hooks/useForms';
import { DEFAULT_CATEGORIES } from '@/lib/domain/constants';
import { applyTimeBlockDeleteScope, applyTimeBlockEditScope } from '@/lib/domain/helpers';
import {
  buildCategoryFromFormValues,
  buildTaskFromFormValues,
  buildTimeBlockSeriesFromFormValues,
} from '@/lib/forms/mappers';
import type {
  CategoryFormValues,
  TaskFormValues,
  TimeBlockFormValues,
} from '@/lib/forms/schemas';
import type {
  Category,
  RecurringDeleteScope,
  RecurringEditScope,
  Task,
  TimeBlock,
} from '@/lib/domain/types';
import { MOCK_PROJECTS, MOCK_TAGS, MOCK_TASKS } from '@/lib/mock/tasks';
import { MOCK_TIME_BLOCKS } from '@/lib/mock/time-blocks';

export default function FormsDemoPage() {
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [timeBlocks, setTimeBlocks] = useState(MOCK_TIME_BLOCKS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  const taskForm = useTaskForm<Task>();
  const timeBlockForm = useTimeBlockForm<TimeBlock>();
  const categoryForm = useCategoryForm<Category>();

  const handleTaskSubmit = async (data: TaskFormValues) => {
    const nextTask = buildTaskFromFormValues(data, taskForm.initialData);
    setTasks((currentTasks) => {
      const exists = currentTasks.some((task) => task.id === nextTask.id);
      return exists
        ? currentTasks.map((task) => (task.id === nextTask.id ? nextTask : task))
        : [nextTask, ...currentTasks];
    });
  };

  const handleTaskDelete = async () => {
    const taskId = taskForm.initialData?.id;
    if (!taskId) {
      return;
    }

    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
    setTimeBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.taskId === taskId
          ? {
              ...block,
              taskId: undefined,
            }
          : block
      )
    );
  };

  const handleTimeBlockSubmit = async (
    data: TimeBlockFormValues,
    scope: RecurringEditScope = 'single'
  ) => {
    const category = categories.find((item) => item.id === data.categoryId);
    const nextBlocks = buildTimeBlockSeriesFromFormValues(data, timeBlockForm.initialData, {
      compensationDefaults: {
        hourlyRate: category?.hourlyRate ?? null,
        currency: category?.currency ?? null,
      },
    });

    if (timeBlockForm.initialData?.id && nextBlocks.length === 1) {
      const previousBlock = timeBlocks.find((block) => block.id === timeBlockForm.initialData?.id);

      if (previousBlock?.recurrence?.seriesId && scope !== 'single') {
        const scopedBlocks = applyTimeBlockEditScope(timeBlocks, previousBlock, nextBlocks[0], scope);

        setTimeBlocks((currentBlocks) =>
          currentBlocks.map((block) => scopedBlocks.find((item) => item.id === block.id) ?? block)
        );
        return;
      }
    }

    setTimeBlocks((currentBlocks) => {
      let updatedBlocks = [...currentBlocks];

      nextBlocks.forEach((nextBlock) => {
        const exists = updatedBlocks.some((block) => block.id === nextBlock.id);
        updatedBlocks = exists
          ? updatedBlocks.map((block) => (block.id === nextBlock.id ? nextBlock : block))
          : [nextBlock, ...updatedBlocks];
      });

      return updatedBlocks;
    });
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

    const { remainingBlocks, deletedBlocks } = applyTimeBlockDeleteScope(
      timeBlocks,
      blockToDelete,
      scope
    );
    setTimeBlocks(remainingBlocks);

    const deletedTaskIds = new Set(
      deletedBlocks
        .map((block) => block.taskId)
        .filter((taskId): taskId is Task['id'] => Boolean(taskId))
    );
    const deletedBlockIds = new Set(deletedBlocks.map((block) => block.id));

    if (deletedTaskIds.size > 0) {
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          deletedTaskIds.has(task.id) ||
          (task.calendarBlockId ? deletedBlockIds.has(task.calendarBlockId) : false)
            ? {
                ...task,
                scheduledStart: undefined,
                scheduledEnd: undefined,
                calendarBlockId: undefined,
              }
            : task
        )
      );
    }
  };

  const handleCategorySubmit = async (data: CategoryFormValues) => {
    const nextCategory = buildCategoryFromFormValues(data, categoryForm.initialData);
    setCategories((currentCategories) => {
      const exists = currentCategories.some((category) => category.id === nextCategory.id);
      return exists
        ? currentCategories.map((category) =>
            category.id === nextCategory.id ? nextCategory : category
          )
        : [...currentCategories, nextCategory];
    });
  };

  const handleCategoryDelete = async () => {
    const categoryId = categoryForm.initialData?.id;
    if (!categoryId) {
      return;
    }

    const fallbackCategoryId = DEFAULT_CATEGORIES[0]?.id;

    setCategories((currentCategories) =>
      currentCategories.filter((category) => category.id !== categoryId)
    );

    if (!fallbackCategoryId) {
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.categoryId === categoryId
          ? {
              ...task,
              categoryId: fallbackCategoryId,
            }
          : task
      )
    );

    setTimeBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.categoryId === categoryId
          ? {
              ...block,
              categoryId: fallbackCategoryId,
            }
          : block
      )
    );
  };

  return (
    <PageShell>
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Forms Demo</h1>
        <p className="mt-2 text-sm text-slate-600">
          Reusable create and edit flows for tasks, time blocks, and categories using local mock
          state.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Task Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">{tasks.length} tasks in local demo state.</p>
            <Button onClick={() => taskForm.openCreate()} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Create Task
            </Button>
            <Button
              variant="secondary"
              onClick={() => taskForm.openEdit(tasks[0])}
              className="w-full"
            >
              Edit First Task
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time Block Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              {timeBlocks.length} blocks in local demo state.
            </p>
            <Button onClick={() => timeBlockForm.openCreate()} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Create Block
            </Button>
            <Button
              variant="secondary"
              onClick={() => timeBlockForm.openEdit(timeBlocks[0])}
              className="w-full"
            >
              Edit First Block
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              {categories.length} categories in local demo state.
            </p>
            <Button onClick={() => categoryForm.openCreate()} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Create Category
            </Button>
            <Button
              variant="secondary"
              onClick={() => categoryForm.openEdit(categories[0])}
              className="w-full"
            >
              Edit First Category
            </Button>
          </CardContent>
        </Card>
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
        projects={MOCK_PROJECTS}
        tags={MOCK_TAGS}
        timeBlocks={timeBlocks}
        onSubmit={handleTaskSubmit}
        onDelete={handleTaskDelete}
      />

      <TimeBlockForm
        open={timeBlockForm.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            timeBlockForm.close();
          }
        }}
        mode={timeBlockForm.mode}
        initialData={timeBlockForm.initialData}
        categories={categories}
        tags={MOCK_TAGS}
        tasks={tasks}
        onSubmit={handleTimeBlockSubmit}
        onDelete={handleTimeBlockDelete}
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
        onDelete={handleCategoryDelete}
      />
    </PageShell>
  );
}
