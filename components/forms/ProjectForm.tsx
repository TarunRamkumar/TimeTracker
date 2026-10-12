'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Category, Project } from '@/lib/domain/types';
import { DEFAULT_CATEGORIES } from '@/lib/domain/constants';
import { getCategoryPathLabel } from '@/lib/domain/helpers';
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
import { getProjectFormDefaults } from '@/lib/forms/defaults';
import {
  projectFormSchema,
  type ProjectFormInput,
  type ProjectFormValues,
} from '@/lib/forms/schemas';

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'create' | 'edit';
  initialData?: Partial<Project> | null;
  categories?: Category[];
  onSubmit: (data: ProjectFormValues) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  isLoading?: boolean;
}

export function ProjectForm({
  open,
  onOpenChange,
  mode = 'create',
  initialData,
  categories = DEFAULT_CATEGORIES,
  onSubmit,
  onDelete,
  isLoading = false,
}: ProjectFormProps) {
  const defaults = getProjectFormDefaults(initialData);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProjectFormInput, unknown, ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: defaults,
  });

  const categoryId = useWatch({ control, name: 'categoryId' });
  const categoryPathLabel = getCategoryPathLabel(categories, categoryId as Category['id']);

  useEffect(() => {
    reset(getProjectFormDefaults(initialData));
  }, [initialData, open, reset]);

  const handleClose = () => {
    reset(getProjectFormDefaults(initialData));
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

    if (!window.confirm('Delete this project? Tasks will remain and be unassigned from the project.')) {
      return;
    }

    await onDelete();
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative max-w-xl">
        <DialogClose onClick={handleClose} />
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Project' : 'Create Project'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleFormSubmit} className="space-y-5">
          <FormField label="Project name" error={errors.name?.message} required>
            <Input placeholder="Spring Portfolio Refresh" {...register('name')} />
          </FormField>

          <FormField label="Description" error={errors.description?.message}>
            <TextArea
              placeholder="Define the scope of the project and the kind of work it should contain."
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
                    label: getCategoryPathLabel(categories, category.id) || category.name,
                  })),
                ]}
                {...register('categoryId')}
              />
            </FormField>

            <FormField label="Status" error={errors.status?.message} required>
              <Select
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'archived', label: 'Archived' },
                ]}
                {...register('status')}
              />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Start date" error={errors.startDate?.message}>
              <Input type="date" {...register('startDate')} />
            </FormField>

            <FormField label="End date" error={errors.endDate?.message}>
              <Input type="date" {...register('endDate')} />
            </FormField>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Analytics inheritance
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {categoryPathLabel || 'Choose a category to define the project hierarchy'}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Tasks inside this project inherit the project category, and parent categories roll up
              with it in analytics. If you add project dates, matching start and end markers are
              created on the calendar automatically.
            </p>
          </div>

          <div
            className={`flex gap-3 border-t border-slate-200 pt-4 ${
              mode === 'edit' && onDelete ? 'justify-between' : 'justify-end'
            }`}
          >
            {mode === 'edit' && onDelete ? (
              <Button variant="danger" onClick={handleDelete} disabled={isLoading}>
                Delete Project
              </Button>
            ) : null}
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : mode === 'edit' ? 'Update Project' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
