'use client';

import { useState } from 'react';

type EditorMode = 'create' | 'edit';

interface EditorState<T> {
  isOpen: boolean;
  mode: EditorMode;
  initialData: Partial<T> | null;
}

export function useEntityEditor<T>() {
  const [state, setState] = useState<EditorState<T>>({
    isOpen: false,
    mode: 'create',
    initialData: null,
  });

  const openCreate = (initialData?: Partial<T> | null) => {
    setState({
      isOpen: true,
      mode: 'create',
      initialData: initialData ?? null,
    });
  };

  const openEdit = (initialData: Partial<T>) => {
    setState({
      isOpen: true,
      mode: 'edit',
      initialData,
    });
  };

  const close = () => {
    setState({
      isOpen: false,
      mode: 'create',
      initialData: null,
    });
  };

  return {
    ...state,
    openCreate,
    openEdit,
    close,
  };
}

export const useTaskForm = useEntityEditor;
export const useTimeBlockForm = useEntityEditor;
export const useCategoryForm = useEntityEditor;
export const useProjectForm = useEntityEditor;
