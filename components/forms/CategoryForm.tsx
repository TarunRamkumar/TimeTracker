'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Category } from '@/lib/domain/types';
import { CATEGORY_ICONS } from '@/lib/domain/constants';
import {
  formatCurrency,
  getCategoryDescendantIds,
  getCategoryPathLabel,
  normalizeCurrency,
} from '@/lib/domain/helpers';
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
import { getCategoryFormDefaults } from '@/lib/forms/defaults';
import {
  categoryFormSchema,
  type CategoryFormInput,
  type CategoryFormValues,
} from '@/lib/forms/schemas';

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'create' | 'edit';
  initialData?: Partial<Category> | null;
  categories?: Category[];
  onSubmit: (data: CategoryFormValues) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  isLoading?: boolean;
}

const iconOptions = Array.from(new Set(Object.values(CATEGORY_ICONS)));
const currencyOptions = [
  { value: '', label: 'Use USD' },
  { value: 'USD', label: 'USD' },
  { value: 'CAD', label: 'CAD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
] as Array<{ value: string; label: string }>;

export function CategoryForm({
  open,
  onOpenChange,
  mode = 'create',
  initialData,
  categories = [],
  onSubmit,
  onDelete,
  isLoading = false,
}: CategoryFormProps) {
  const defaults = getCategoryFormDefaults(initialData);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<CategoryFormInput, unknown, CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: defaults,
  });

  const selectedColor = useWatch({ control, name: 'color' });
  const categoryName = useWatch({ control, name: 'name' });
  const isActive = useWatch({ control, name: 'active' });
  const hourlyRate = useWatch({ control, name: 'hourlyRate' });
  const currency = useWatch({ control, name: 'currency' });
  const selectedParentCategoryIds = useWatch({ control, name: 'parentCategoryIds' }) ?? [];
  const parsedCurrency = typeof currency === 'string' ? currency : undefined;
  const parsedHourlyRate =
    typeof hourlyRate === 'number'
      ? hourlyRate
      : typeof hourlyRate === 'string' && hourlyRate.trim() !== ''
        ? Number(hourlyRate)
        : undefined;
  const hasCompensation = typeof parsedHourlyRate === 'number' && Number.isFinite(parsedHourlyRate);
  const previewHourlyRate = hasCompensation ? parsedHourlyRate ?? 0 : 0;
  const invalidParentIds = new Set(
    initialData?.id ? getCategoryDescendantIds(categories, initialData.id) : []
  );
  const parentOptions = categories
    .filter((category) => !invalidParentIds.has(category.id))
    .map((category) => ({
      value: category.id,
      label: getCategoryPathLabel(categories, category.id) || category.name,
    }));
  const parentLabels = selectedParentCategoryIds
    .map((parentCategoryId) => getCategoryPathLabel(categories, parentCategoryId as Category['id']))
    .filter((label, index, labels) => label.length > 0 && labels.indexOf(label) === index);

  useEffect(() => {
    reset(getCategoryFormDefaults(initialData));
  }, [initialData, open, reset]);

  const handleParentToggle = (parentCategoryId: string) => {
    const nextParentCategoryIds = selectedParentCategoryIds.includes(parentCategoryId)
      ? selectedParentCategoryIds.filter((currentId) => currentId !== parentCategoryId)
      : [...selectedParentCategoryIds, parentCategoryId];

    setValue('parentCategoryIds', nextParentCategoryIds, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleClose = () => {
    reset(getCategoryFormDefaults(initialData));
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

    if (!window.confirm('Delete this category? This cannot be undone.')) {
      return;
    }

    await onDelete();
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative max-w-2xl">
        <DialogClose onClick={handleClose} />
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Category' : 'Create Category'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleFormSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <FormField label="Name" error={errors.name?.message} required>
              <Input placeholder="Deep Work" {...register('name')} />
            </FormField>

            <FormField label="Color" error={errors.color?.message} required>
              <div className="flex items-center gap-3">
                <div
                  className="h-11 w-11 rounded-2xl border border-slate-200"
                  style={{ backgroundColor: selectedColor }}
                />
                <Input type="color" {...register('color')} className="h-11 w-16 p-1" />
                <span className="text-sm text-slate-500">{selectedColor}</span>
              </div>
            </FormField>
          </div>

          <FormField label="Description" error={errors.description?.message}>
            <TextArea
              placeholder="Explain when this category should be used across tasks and time blocks."
              {...register('description')}
            />
          </FormField>

          <FormField
            label="Parent categories"
            error={errors.parentCategoryIds?.message as string | undefined}
          >
            <details className="group rounded-2xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm text-slate-700">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {parentLabels.length > 0
                      ? parentLabels.join(' • ')
                      : 'No parent categories'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedParentCategoryIds.length > 0
                      ? `${selectedParentCategoryIds.length} selected`
                      : 'Choose one or more parent categories'}
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-500 transition-transform group-open:rotate-180">
                  ▼
                </span>
              </summary>

              <div className="border-t border-slate-200 px-3 py-3">
                {parentOptions.length > 0 ? (
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {parentOptions.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                          selectedParentCategoryIds.includes(option.value)
                            ? 'bg-slate-50 text-slate-900'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedParentCategoryIds.includes(option.value)}
                          onChange={() => handleParentToggle(option.value)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl px-3 py-3 text-sm text-slate-500">
                    No valid parent categories available.
                  </div>
                )}
              </div>
            </details>
          </FormField>

          <FormField label="Icon" error={errors.icon?.message} required>
            <div className="grid gap-2 sm:grid-cols-2">
              {iconOptions.map((icon) => (
                <label
                  key={icon}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                >
                  <input type="radio" value={icon} {...register('icon')} className="h-4 w-4" />
                  <span>{icon}</span>
                </label>
              ))}
            </div>
          </FormField>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-900">Default compensation</p>
              <p className="text-xs leading-5 text-slate-500">
                Optional. New calendar events in this category can inherit the same hourly rate.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px]">
              <FormField label="Hourly rate" error={errors.hourlyRate?.message}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="25"
                  {...register('hourlyRate')}
                />
              </FormField>

              <FormField label="Currency" error={errors.currency?.message}>
                <Select options={currencyOptions} {...register('currency')} />
              </FormField>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Applied to new events
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {hasCompensation
                  ? `${formatCurrency(previewHourlyRate, parsedCurrency)} / hr`
                  : 'No default compensation'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {hasCompensation
                  ? `New blocks can inherit ${formatCurrency(previewHourlyRate, parsedCurrency)} per hour from ${categoryName || 'this category'}.`
                  : 'Leave this empty if only certain blocks should be paid.'}
              </p>
            </div>
          </div>

          <FormField label="Active" error={errors.active?.message as string | undefined}>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
              <input type="checkbox" {...register('active')} className="h-4 w-4 rounded border-slate-300" />
              <span>{isActive ? 'Category is active and available in forms.' : 'Category is inactive.'}</span>
            </label>
          </FormField>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Preview</p>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm shadow-slate-200/60">
              <div className="flex items-center gap-3">
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: selectedColor }}
                />
                <div>
                  <p className="font-medium text-slate-900">{categoryName || 'Category name'}</p>
                  <p className="text-xs text-slate-500">
                    {isActive ? 'Active' : 'Inactive'}
                    {hasCompensation
                      ? ` • ${formatCurrency(previewHourlyRate, normalizeCurrency(parsedCurrency))}/hr default`
                      : ''}
                  </p>
                  {parentLabels.length > 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Parents: {parentLabels.join(' • ')}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div
            className={`flex gap-3 border-t border-slate-200 pt-4 ${
              mode === 'edit' && onDelete ? 'justify-between' : 'justify-end'
            }`}
          >
            {mode === 'edit' && onDelete ? (
              <Button variant="danger" onClick={handleDelete} disabled={isLoading}>
                Delete Category
              </Button>
            ) : null}
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : mode === 'edit' ? 'Update Category' : 'Create Category'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
