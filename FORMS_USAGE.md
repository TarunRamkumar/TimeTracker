// Example usage of the form components
// This file demonstrates how to integrate TaskForm, TimeBlockForm, and CategoryForm
// into your pages using the useForms hook

'use client';

import { useState } from 'react';
import { TaskForm } from '@/components/forms/TaskForm';
import { TimeBlockForm } from '@/components/forms/TimeBlockForm';
import { CategoryForm } from '@/components/forms/CategoryForm';
import { useTaskForm, useTimeBlockForm, useCategoryForm } from '@/hooks/useForms';
import { Button } from '@/components/ui';
import { Plus } from 'lucide-react';
import type { TaskFormValues, TimeBlockFormValues, CategoryFormValues } from '@/lib/forms/schemas';

/**
 * EXAMPLE 1: Basic usage in a page component
 * This shows how to integrate forms with state management
 */
export function FormsExamplePage() {
  // Initialize form hooks
  const taskForm = useTaskForm();
  const timeBlockForm = useTimeBlockForm();
  const categoryForm = useCategoryForm();

  // Handle task form submission
  const handleTaskSubmit = async (data: TaskFormValues) => {
    console.log('Task form data:', data);
    await taskForm.handleSubmit(data);
    // In a real app, you would:
    // - Dispatch to state management (Redux, Zustand, etc)
    // - Call an API endpoint
    // - Update local state
  };

  // Handle time block form submission
  const handleTimeBlockSubmit = async (data: TimeBlockFormValues) => {
    console.log('Time block form data:', data);
    await timeBlockForm.handleSubmit(data);
  };

  // Handle category form submission
  const handleCategorySubmit = async (data: CategoryFormValues) => {
    console.log('Category form data:', data);
    await categoryForm.handleSubmit(data);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Forms Integration Example</h1>

      {/* Task Management Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Tasks</h2>
          <Button
            variant="primary"
            size="sm"
            onClick={taskForm.openCreate}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
        <p className="text-gray-600 text-sm">
          Click &ldquo;New Task&rdquo; to create a task using the form dialog
        </p>
      </div>

      {/* Time Block Management Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Time Blocks</h2>
          <Button
            variant="primary"
            size="sm"
            onClick={timeBlockForm.openCreate}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Block
          </Button>
        </div>
        <p className="text-gray-600 text-sm">
          Click &ldquo;New Block&rdquo; to schedule time using the form sheet
        </p>
      </div>

      {/* Category Management Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Categories</h2>
          <Button
            variant="primary"
            size="sm"
            onClick={categoryForm.openCreate}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Category
          </Button>
        </div>
        <p className="text-gray-600 text-sm">
          Click &ldquo;New Category&rdquo; to create a category using the form dialog
        </p>
      </div>

      {/* Form Components */}
      <TaskForm
        open={taskForm.isOpen}
        onOpenChange={(open) => (open ? null : taskForm.close())}
        initialData={taskForm.editingItem}
        onSubmit={handleTaskSubmit}
        isLoading={taskForm.isLoading}
      />

      <TimeBlockForm
        open={timeBlockForm.isOpen}
        onOpenChange={(open) => (open ? null : timeBlockForm.close())}
        initialData={timeBlockForm.editingItem}
        onSubmit={handleTimeBlockSubmit}
        isLoading={timeBlockForm.isLoading}
      />

      <CategoryForm
        open={categoryForm.isOpen}
        onOpenChange={(open) => (open ? null : categoryForm.close())}
        initialData={categoryForm.editingItem}
        onSubmit={handleCategorySubmit}
        isLoading={categoryForm.isLoading}
      />
    </div>
  );
}

/**
 * EXAMPLE 2: Integration with existing state management
 * This shows how to integrate forms with your existing data layer
 */

/*
// If using Zustand for state management:
import { useTaskStore } from '@/store/tasks'; // hypothetical store

export function TasksPageWithState() {
  const { tasks, createTask, updateTask } = useTaskStore();
  const taskForm = useTaskForm();

  const handleTaskSubmit = async (data: TaskFormValues) => {
    if (taskForm.editingItem) {
      await updateTask(taskForm.editingItem.id, data);
    } else {
      await createTask(data);
    }
    taskForm.close();
  };

  return (
    // ... JSX
  );
}

// If using API calls:
export function TasksPageWithAPI() {
  const [tasks, setTasks] = useState([]);
  const taskForm = useTaskForm();

  const handleTaskSubmit = async (data: TaskFormValues) => {
    const response = await fetch('/api/tasks', {
      method: taskForm.editingItem ? 'PATCH' : 'POST',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    setTasks([...tasks, result]); // or update existing
    taskForm.close();
  };

  return (
    // ... JSX
  );
}
*/

/**
 * EXAMPLE 3: Form configuration and customization
 *
 * The form schemas can be extended or modified for your needs:
 *
 * // In lib/forms/schemas.ts - customize validation:
 * export const customTaskSchema = taskFormSchema.extend({
 *   customField: z.string().optional(),
 * });
 *
 * // In components - use custom schema:
 * const { handleSubmit } = useForm({
 *   resolver: zodResolver(customTaskSchema),
 * });
 */

/**
 * EXAMPLE 4: Triggering edit mode
 *
 * To edit an existing item, pass it to openEdit:
 *
 * const existingTask = tasks[0];
 * taskForm.openEdit(existingTask);
 *
 * The form will:
 * - Populate all fields from the existing data
 * - Show "Edit Task" in the dialog title
 * - Show "Update Task" in the submit button
 */

/**
 * NOTES ON FORM FEATURES:
 *
 * ✅ React Hook Form Integration
 * - Form state management
 * - Field validation
 * - Error handling
 * - Submit handling
 *
 * ✅ Zod Schema Validation
 * - Type-safe form data
 * - Runtime validation
 * - Error messages
 * - Custom validation rules
 *
 * ✅ shadcn/ui Components
 * - Dialog (for TaskForm and CategoryForm)
 * - Sheet (for TimeBlockForm - drawer from right)
 * - FormField, Input, TextArea, Select, Checkbox
 *
 * ✅ Local State Management (useForms hook)
 * - Create/edit mode toggle
 * - Form open/close state
 * - Loading states
 * - Default values
 *
 * ✅ Form Fields Match Domain Model
 * - TaskForm: title, description, category, status, priority, estimate, due date, tags, project
 * - TimeBlockForm: title, description, category, start/end times, duration, task link, tags
 * - CategoryForm: name, description, color picker, icon selector
 *
 * ✅ Validation & Defaults
 * - All required fields marked
 * - Min/max length validation
 * - Sensible defaults for new items
 * - Custom validation (e.g., end time > start time)
 * - Error display below each field
 */
