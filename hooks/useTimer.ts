'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { TimerSession, TimerSessionId, TaskId, CategoryId } from '@/lib/domain/types';
import { createCategoryId } from '@/lib/domain/constants';

interface UseTimerState {
  isRunning: boolean;
  elapsedSeconds: number;
  sessionId: TimerSessionId | null;
  startedAt: Date | null;
  taskId?: TaskId;
  categoryId: CategoryId;
}

export function useTimer(initialCategoryId: CategoryId = createCategoryId('cat-work')) {
  const [state, setState] = useState<UseTimerState>({
    isRunning: false,
    elapsedSeconds: 0,
    sessionId: null,
    startedAt: null,
    categoryId: initialCategoryId,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<Date | null>(null);

  // Update elapsed time every second when running
  useEffect(() => {
    if (!state.isRunning || !sessionStartRef.current) {
      return;
    }

    intervalRef.current = setInterval(() => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - sessionStartRef.current!.getTime()) / 1000);
      setState((prev) => ({
        ...prev,
        elapsedSeconds: elapsed,
      }));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.isRunning]);

  const startTimer = useCallback((taskId?: TaskId, categoryId?: CategoryId) => {
    const sessionId = `session-${Date.now()}` as TimerSessionId;
    const now = new Date();

    setState({
      isRunning: true,
      elapsedSeconds: 0,
      sessionId,
      startedAt: now,
      taskId,
      categoryId: categoryId || initialCategoryId,
    });

    sessionStartRef.current = now;
  }, [initialCategoryId]);

  const stopTimer = useCallback((): TimerSession | null => {
    if (!state.sessionId || !state.startedAt) {
      return null;
    }

    const endTime = new Date();
    const durationMinutes = Math.round(state.elapsedSeconds / 60);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const session: TimerSession = {
      id: state.sessionId,
      taskId: state.taskId,
      categoryId: state.categoryId,
      startTime: state.startedAt,
      endTime,
      durationMinutes,
      pomodoroMode: false,
      source: 'web',
    };

    setState({
      isRunning: false,
      elapsedSeconds: 0,
      sessionId: null,
      startedAt: null,
      categoryId: initialCategoryId,
    });

    sessionStartRef.current = null;

    return session;
  }, [state, initialCategoryId]);

  const resetTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setState({
      isRunning: false,
      elapsedSeconds: 0,
      sessionId: null,
      startedAt: null,
      categoryId: initialCategoryId,
    });

    sessionStartRef.current = null;
  }, [initialCategoryId]);

  const pauseTimer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isRunning: false,
    }));
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, []);

  const resumeTimer = useCallback(() => {
    if (!state.sessionId || !state.startedAt) {
      return;
    }

    // Adjust the session start time to account for pause duration
    const pausedDuration = state.elapsedSeconds * 1000;
    sessionStartRef.current = new Date(new Date().getTime() - pausedDuration);

    setState((prev) => ({
      ...prev,
      isRunning: true,
    }));
  }, [state.sessionId, state.startedAt, state.elapsedSeconds]);

  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
        secs
      ).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  return {
    ...state,
    startTimer,
    stopTimer,
    resetTimer,
    pauseTimer,
    resumeTimer,
    formatTime,
  };
}
