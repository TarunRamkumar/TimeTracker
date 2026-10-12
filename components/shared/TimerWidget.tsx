'use client';

import { Play, Pause, RotateCcw, StopCircle } from 'lucide-react';
import { useAppData } from '@/components/providers/AppDataProvider';
import { formatMinutes } from '@/lib/domain/helpers';
import { Button } from '../ui';

export function TimerWidget() {
  const {
    activeTimer,
    activeTask,
    activeElapsedSeconds,
    activeElapsedLabel,
    isTimerRunning,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    resetTimer,
    timerSessions,
  } = useAppData();
  const lastSession = timerSessions[0];

  const handleStart = () => {
    startTimer();
  };

  const handleStop = () => {
    stopTimer();
  };

  const handlePause = () => {
    pauseTimer();
  };

  const handleResume = () => {
    resumeTimer();
  };

  const handleReset = () => {
    resetTimer();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-sm font-medium text-gray-900 mb-4">In-App Timer</h3>

      <div className="text-center mb-6">
        <div className="text-4xl font-mono font-bold text-gray-900 mb-2">
          {activeElapsedLabel}
        </div>
        <p className="text-xs text-gray-600">
          {activeTimer
            ? isTimerRunning
              ? activeTask
                ? `Working on ${activeTask.title}`
                : 'Timer running...'
              : 'Timer paused'
            : 'Not started'}
        </p>
      </div>

      <div className="flex gap-2 justify-center">
        {!activeTimer && (
          <Button size="sm" onClick={handleStart} variant="primary">
            <Play className="w-4 h-4" />
            Start
          </Button>
        )}

        {activeTimer && isTimerRunning && (
          <>
            <Button size="sm" onClick={handlePause} variant="secondary">
              <Pause className="w-4 h-4" />
              Pause
            </Button>
            <Button size="sm" onClick={handleStop} variant="danger">
              <StopCircle className="w-4 h-4" />
              Stop
            </Button>
          </>
        )}

        {activeTimer && !isTimerRunning && activeElapsedSeconds > 0 && (
          <>
            <Button size="sm" onClick={handleResume} variant="primary">
              <Play className="w-4 h-4" />
              Resume
            </Button>
            <Button size="sm" onClick={handleStop} variant="danger">
              <StopCircle className="w-4 h-4" />
              Stop
            </Button>
          </>
        )}

        {activeTimer && activeElapsedSeconds > 0 && (
          <Button size="sm" onClick={handleReset} variant="ghost">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        )}
      </div>

      {lastSession && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-xs text-green-700">
            Session recorded: {formatMinutes(lastSession.durationMinutes)}
          </p>
        </div>
      )}
    </div>
  );
}
