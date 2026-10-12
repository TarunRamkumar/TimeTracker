const presetButtons = Array.from(document.querySelectorAll('[data-preset]'));
const actionButtons = Array.from(document.querySelectorAll('[data-action]'));
const timerReadout = document.getElementById('timer-readout');
const statusText = document.getElementById('status-text');

let activePreset = 'focus-25';

const presetReadouts = {
  'focus-25': '25:00',
  'deep-work-50': '50:00',
  custom: 'Custom',
};

presetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activePreset = button.dataset.preset || 'focus-25';
    presetButtons.forEach((candidate) => {
      candidate.classList.toggle('is-active', candidate === button);
    });

    if (timerReadout) {
      timerReadout.textContent = presetReadouts[activePreset] || '25:00';
    }

    if (statusText) {
      statusText.textContent =
        'Preset selection is local scaffold state only. Background countdown logic is not wired yet.';
    }
  });
});

actionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;

    if (!statusText) {
      return;
    }

    if (action === 'start-timer') {
      statusText.textContent =
        `Start requested for preset "${activePreset}". Future popup logic will message the background worker instead of running a timer here.`;
      return;
    }

    if (action === 'stop-timer') {
      statusText.textContent =
        'Stop requested. Future logic will finalize a session, sync it to the app backend, and optionally queue a calendar focus update.';
    }
  });
});
