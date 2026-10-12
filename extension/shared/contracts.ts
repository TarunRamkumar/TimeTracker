export type PomodoroPresetId = 'focus-25' | 'deep-work-50' | 'custom';

export interface ExtensionTaskSummary {
  id: string;
  title: string;
  projectName?: string;
  categoryName?: string;
  estimatedMinutes?: number;
}

export interface ExtensionPomodoroPreset {
  id: PomodoroPresetId;
  label: string;
  focusMinutes: number;
  breakMinutes: number;
}

export interface ExtensionTimerState {
  status: 'idle' | 'running' | 'paused' | 'completed';
  taskId?: string;
  startedAt?: string;
  endsAt?: string;
  elapsedSeconds: number;
  presetId?: PomodoroPresetId;
}

export interface CompletedSessionSyncPayload {
  taskId?: string;
  categoryId?: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  pomodoroMode: boolean;
  source: 'chrome-extension';
}

export interface FocusEventSyncPayload {
  taskId?: string;
  title: string;
  start: string;
  end: string;
  plannedMinutes: number;
}

export interface ExtensionBootstrapState {
  tasks: ExtensionTaskSummary[];
  presets: ExtensionPomodoroPreset[];
  timer: ExtensionTimerState;
  syncStatus: 'idle' | 'pending' | 'error';
}

export type PopupToBackgroundMessage =
  | { type: 'extension/bootstrap' }
  | { type: 'timer/start'; taskId?: string; presetId: PomodoroPresetId }
  | { type: 'timer/stop' }
  | { type: 'timer/pause' }
  | { type: 'timer/resume' }
  | { type: 'session/sync-latest' };

export type BackgroundToPopupMessage =
  | { type: 'extension/bootstrap-result'; payload: ExtensionBootstrapState }
  | { type: 'timer/state-changed'; payload: ExtensionTimerState }
  | { type: 'extension/not-implemented'; message: string };
