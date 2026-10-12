const extensionState = {
  selectedTaskId: undefined,
  activePresetId: 'focus-25',
  timer: {
    status: 'idle',
    taskId: undefined,
    startedAt: undefined,
    endsAt: undefined,
    elapsedSeconds: 0,
    presetId: 'focus-25',
  },
  syncStatus: 'idle',
};

const bootstrapPayload = {
  tasks: [
    {
      id: 'task-1',
      title: 'Design dashboard layout',
      projectName: 'Website Redesign',
      categoryName: 'Work',
      estimatedMinutes: 120,
    },
    {
      id: 'task-5',
      title: 'Complete ML research paper',
      projectName: 'ML Research',
      categoryName: 'Internship',
      estimatedMinutes: 240,
    },
    {
      id: 'task-3',
      title: 'Study quantum mechanics Chapter 5',
      categoryName: 'Study',
      estimatedMinutes: 90,
    },
  ],
  presets: [
    { id: 'focus-25', label: '25 / 5', focusMinutes: 25, breakMinutes: 5 },
    { id: 'deep-work-50', label: '50 / 10', focusMinutes: 50, breakMinutes: 10 },
    { id: 'custom', label: 'Custom', focusMinutes: 0, breakMinutes: 0 },
  ],
  timer: extensionState.timer,
  syncStatus: extensionState.syncStatus,
};

const runtime = globalThis.chrome?.runtime;

if (runtime?.onInstalled) {
  runtime.onInstalled.addListener(() => {
    console.info('TimeTracker extension scaffold installed.');
  });
}

if (runtime?.onMessage) {
  runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message?.type) {
      case 'extension/bootstrap':
        sendResponse({
          type: 'extension/bootstrap-result',
          payload: bootstrapPayload,
        });
        return true;

      case 'timer/start':
      case 'timer/stop':
      case 'timer/pause':
      case 'timer/resume':
      case 'session/sync-latest':
        sendResponse({
          type: 'extension/not-implemented',
          message:
            'This scaffold does not run live timer, backend, or Google Calendar logic yet.',
        });
        return true;

      default:
        sendResponse({
          type: 'extension/not-implemented',
          message: 'Unknown extension message received by scaffold service worker.',
        });
        return true;
    }
  });
}
