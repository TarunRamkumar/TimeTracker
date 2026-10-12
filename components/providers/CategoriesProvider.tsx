'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { DEFAULT_CATEGORIES } from '@/lib/domain/constants';
import type { Category, CategoryId } from '@/lib/domain/types';

interface CategoriesContextValue {
  categories: Category[];
  setCategories: Dispatch<SetStateAction<Category[]>>;
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null);
const STORAGE_KEY = 'timetracker-categories';

function normalizeCategory(category: Category & { parentCategoryId?: CategoryId }): Category {
  const { parentCategoryId: legacyParentCategoryId, ...rest } = category;
  const parentCategoryIds = Array.isArray(category.parentCategoryIds)
    ? category.parentCategoryIds
    : legacyParentCategoryId
      ? [legacyParentCategoryId]
      : [];

  return {
    ...rest,
    parentCategoryIds: [...new Set(parentCategoryIds)].filter((id) => id !== category.id),
  };
}

function normalizeCategories(categories?: Category[]) {
  if (!categories || categories.length === 0) {
    return DEFAULT_CATEGORIES;
  }

  return categories.map((category) =>
    normalizeCategory(category as Category & { parentCategoryId?: CategoryId })
  );
}

export function CategoriesProvider({
  children,
  initialCategories,
  preferLocalStateOnBoot = false,
}: {
  children: ReactNode;
  initialCategories?: Category[];
  preferLocalStateOnBoot?: boolean;
}) {
  const [categories, setCategories] = useState<Category[]>(() => {
    if (typeof window === 'undefined') {
      return normalizeCategories(initialCategories);
    }

    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (preferLocalStateOnBoot && storedValue) {
      try {
        const parsed = JSON.parse(storedValue) as Category[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeCategories(parsed);
        }
      } catch {
        // Fall through to the remote bootstrap snapshot.
      }
    }

    if (initialCategories && initialCategories.length > 0) {
      return normalizeCategories(initialCategories);
    }

    if (!storedValue) {
      return DEFAULT_CATEGORIES;
    }

    try {
      const parsed = JSON.parse(storedValue) as Category[];
      return Array.isArray(parsed) ? normalizeCategories(parsed) : DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  }, [categories]);

  const value = useMemo(
    () => ({
      categories,
      setCategories,
    }),
    [categories]
  );

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories() {
  const context = useContext(CategoriesContext);

  if (!context) {
    throw new Error('useCategories must be used within CategoriesProvider.');
  }

  return context;
}
