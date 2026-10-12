import { z } from 'zod';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const optionalText = z.preprocess(
  emptyStringToUndefined,
  z.string().max(500, 'Must be less than 500 characters').optional()
);

const optionalShortText = z.preprocess(
  emptyStringToUndefined,
  z.string().max(120, 'Must be less than 120 characters').optional()
);

const optionalInteger = (max: number, label: string) =>
  z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'number') {
      return value;
    }

    return Number(value);
  }, z.number().int(`${label} must be a whole number`).min(0, `${label} must be positive`).max(max, `${label} is too large`).optional());

const optionalDecimal = (max: number, label: string) =>
  z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'number') {
      return value;
    }

    return Number(value);
  }, z.number().min(0, `${label} must be zero or greater`).max(max, `${label} is too large`).optional());

const optionalDate = z.preprocess((value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'string') {
    if (value.trim() === '') {
      return undefined;
    }

    return new Date(`${value}T00:00:00`);
  }

  return undefined;
}, z.date().optional());

const optionalDateTime = z.preprocess((value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'string') {
    if (value.trim() === '') {
      return undefined;
    }

    return new Date(value);
  }

  return undefined;
}, z.date().optional());

const requiredDateTime = z.preprocess((value) => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return new Date(value);
  }

  return value;
}, z.date({ error: 'Date and time are required' }));

const optionalId = z.preprocess(emptyStringToUndefined, z.string().optional());
const optionalCurrencyCode = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().length(3, 'Use a 3-letter currency code'))
    .optional()
);
const optionalPositiveInteger = (max: number, label: string) =>
  z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'number') {
      return value;
    }

    return Number(value);
  }, z.number().int(`${label} must be a whole number`).min(1, `${label} must be at least 1`).max(max, `${label} is too large`).optional());

export const taskFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(100, 'Title must be less than 100 characters'),
    description: optionalText.transform((value) => value ?? ''),
    status: z.enum(['inbox', 'next', 'doing', 'waiting', 'done']),
    priority: z.enum(['low', 'medium', 'high']),
    projectId: optionalId,
    categoryId: z.string().min(1, 'Category is required'),
    tagIds: z.array(z.string()).default([]),
    dueDate: optionalDate,
    estimatedMinutes: optionalInteger(1440, 'Estimate'),
    scheduledStart: optionalDateTime,
    scheduledEnd: optionalDateTime,
    actualMinutes: optionalInteger(1440, 'Actual minutes'),
    calendarBlockId: optionalId,
  })
  .superRefine((data, ctx) => {
    if (data.scheduledStart && data.scheduledEnd && data.scheduledEnd <= data.scheduledStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Scheduled end must be after scheduled start',
        path: ['scheduledEnd'],
      });
    }
  });

export type TaskFormInput = z.input<typeof taskFormSchema>;
export type TaskFormValues = z.output<typeof taskFormSchema>;

export const timeBlockFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(100, 'Title must be less than 100 characters'),
    description: optionalText.transform((value) => value ?? ''),
    categoryId: z.string().min(1, 'Category is required'),
    tagIds: z.array(z.string()).default([]),
    taskId: optionalId,
    start: requiredDateTime,
    end: requiredDateTime,
    plannedMinutes: optionalInteger(1440, 'Planned minutes'),
    actualMinutes: optionalInteger(1440, 'Actual minutes'),
    hourlyRate: optionalDecimal(100000, 'Hourly rate'),
    currency: optionalCurrencyCode,
    isRecurring: z.preprocess((value) => value === true || value === 'on', z.boolean()).default(false),
    recurrenceDays: z.array(z.enum(['0', '1', '2', '3', '4', '5', '6'])).default([]),
    recurrenceEndType: z.enum(['onDate', 'afterOccurrences']).default('onDate'),
    recurrenceUntil: optionalDate,
    recurrenceCount: optionalPositiveInteger(365, 'Events'),
    source: z.enum(['manual', 'google-calendar', 'task', 'pomodoro']).optional(),
    status: z.enum(['scheduled', 'in-progress', 'completed', 'cancelled']).optional(),
    googleEventId: optionalShortText,
    calendarId: optionalShortText,
  })
  .superRefine((data, ctx) => {
    if (data.end <= data.start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time',
        path: ['end'],
      });
    }

    if (data.isRecurring) {
      if (data.recurrenceDays.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Choose at least one weekday',
          path: ['recurrenceDays'],
        });
      }

      if (data.recurrenceEndType === 'onDate') {
        if (!data.recurrenceUntil) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Choose an end date',
            path: ['recurrenceUntil'],
          });
        } else if (data.recurrenceUntil < new Date(data.start.getFullYear(), data.start.getMonth(), data.start.getDate())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'End date must be on or after the first event',
            path: ['recurrenceUntil'],
          });
        }
      }

      if (data.recurrenceEndType === 'afterOccurrences' && !data.recurrenceCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Choose how many events to create',
          path: ['recurrenceCount'],
        });
      }
    }
  });

export type TimeBlockFormInput = z.input<typeof timeBlockFormSchema>;
export type TimeBlockFormValues = z.output<typeof timeBlockFormSchema>;

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(30, 'Name must be less than 30 characters'),
  description: z
    .preprocess(emptyStringToUndefined, z.string().max(200, 'Description must be less than 200 characters').optional())
    .transform((value) => value ?? ''),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Please enter a valid hex color'),
  parentCategoryIds: z.array(z.string()).default([]),
  icon: z.string().trim().min(1, 'Icon is required').max(50, 'Icon name too long'),
  hourlyRate: optionalDecimal(100000, 'Hourly rate'),
  currency: optionalCurrencyCode,
  active: z.preprocess((value) => {
    if (typeof value === 'boolean') {
      return value;
    }

    if (value === 'on') {
      return true;
    }

    return Boolean(value);
  }, z.boolean()),
});

export type CategoryFormInput = z.input<typeof categoryFormSchema>;
export type CategoryFormValues = z.output<typeof categoryFormSchema>;

export const projectFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name must be less than 80 characters'),
    description: optionalText.transform((value) => value ?? ''),
    status: z.enum(['active', 'archived', 'completed']),
    categoryId: z.string().min(1, 'Category is required'),
    startDate: optionalDate,
    endDate: optionalDate,
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be on or after the start date',
        path: ['endDate'],
      });
    }
  });

export type ProjectFormInput = z.input<typeof projectFormSchema>;
export type ProjectFormValues = z.output<typeof projectFormSchema>;
