# TimeTracker Chrome Extension Scaffold

This folder is a Phase 2 scaffold for a future Chrome extension. It is intentionally buildless and does not contain live browser, backend, or Google Calendar logic yet.

## Intended responsibilities

- show a task picker for quick focus starts
- start and stop a timer outside the main app UI
- support Pomodoro presets and lightweight timer state
- push completed sessions into the TimeTracker backend
- later create or update Google Calendar focus events through the app integration layer

## Structure

- `manifest.json`: Manifest V3 scaffold
- `popup/`: static popup UI shell
- `background/`: service worker message and timer orchestration scaffold
- `shared/contracts.ts`: future extension-to-app and popup-to-background contract shapes

## Planned flow

1. Popup requests bootstrap state from the background worker.
2. Background reads persisted timer state and available task summaries from extension storage or the app backend.
3. User selects a task and a preset, then starts a timer.
4. Background owns the running timer lifecycle so it survives popup closes.
5. When the timer stops, the background prepares a completed session payload.
6. A future sync client sends that payload to the app backend.
7. The app backend decides whether to also create or update a Google Calendar focus event via `lib/integrations`.

## Architecture notes

- Keep provider-specific concerns out of the popup UI.
- The popup should only render state and send intent messages.
- The background worker should own timer orchestration and sync retries.
- Backend sync and Google Calendar writes should happen through app APIs, not directly from popup components.
