import { DIFFICULTIES, type Difficulty } from '../config';
import type { GrantAmount } from '../services/parental';
import { generateRecoveryCode, isTrivialPin } from '../services/pin';
import { clear, formatClock, h } from './dom';
import { icon } from './icons';
import type { App } from './app';
import { otto } from './screens';

const PIN_UNAVAILABLE = 'The PIN can\'t be checked here. Open the game from its https:// address.';

interface PinPad {
  el: HTMLElement;
  message(text: string): void;
  shake(): void;
  reset(): void;
}

/** Enter-twice entry of a new PIN. Hand it each finished entry; it calls `done` with a PIN that passed both checks. */
function newPinFlow(done: (pin: string) => void): (value: string, pad: PinPad) => void {
  let first = '';
  return (value, pad) => {
    if (first === '') {
      if (isTrivialPin(value)) {
        pad.message('That PIN is too easy to guess');
        pad.shake();
        return;
      }
      first = value;
      pad.message('Enter it again');
      return;
    }
    if (value !== first) {
      first = '';
      pad.message("Those didn't match. Start again");
      pad.shake();
      return;
    }
    done(value);
  };
}

function pinPad(title: string, onComplete: (pin: string) => void): PinPad {
  let value = '';
  const heading = h('div', { class: 'pin-title' }, title);
  const dots = h('div', { class: 'pin-dots' }, ...[0, 1, 2, 3].map(() => h('i')));
  const msg = h('div', { class: 'pin-msg' });
  const paint = (): void => {
    [...dots.children].forEach((dot, i) => dot.classList.toggle('on', i < value.length));
  };
  const press = (digit: string): void => {
    if (value.length >= 4) return;
    value += digit;
    paint();
    if (value.length === 4) onComplete(value);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key) => {
    if (key === '') return h('span');
    if (key === 'back') {
      return h('button', {
        html: icon('backspace'), label: 'Delete',
        onTap: () => {
          value = value.slice(0, -1);
          paint();
        },
      });
    }
    return h('button', { dataset: { digit: key }, onTap: () => press(key) }, key);
  });
  const el = h('div', { class: 'pin' }, heading, dots, msg, h('div', { class: 'pin-pad' }, ...keys));
  return {
    el,
    message: (text) => {
      msg.textContent = text;
    },
    shake: () => {
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
    },
    reset: () => {
      value = '';
      paint();
    },
  };
}

function stepper<T>(values: T[], current: () => T, format: (v: T) => string, write: (v: T) => void): HTMLElement {
  const label = h('b', {}, format(current()));
  const move = (dir: number): void => {
    const index = Math.max(0, values.indexOf(current()));
    const next = values[Math.min(values.length - 1, Math.max(0, index + dir))] as T;
    write(next);
    label.textContent = format(next);
  };
  return h(
    'div',
    { class: 'stepper' },
    h('button', { html: icon('minus'), label: 'Less', onTap: () => move(-1) }),
    label,
    h('button', { html: icon('plus'), label: 'More', onTap: () => move(1) }),
  );
}

const minutesFormat = (v: number | null): string => (v === null ? 'Off' : `${v} min`);
const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
};
const DAILY_OPTIONS: (number | null)[] = [null, ...range(10, 180, 5)];

/* ---------- First-run wizard (13.1) ---------- */

export function wizardScreen(app: App): HTMLElement {
  const body = h('div', { class: 'wizard' });
  const root = h('div', { class: 'screen deep center', id: 'wizard' }, body);
  let pin = '';
  const code = generateRecoveryCode();
  let dailyLimit: number | null = 30;

  const intro = (): void => {
    clear(body);
    body.append(
      otto('point', 170),
      h('h2', {}, 'This part is for grown-ups'),
      h('p', {}, 'Set a PIN so you stay in charge of play time. It only takes a minute.'),
      h('button', { class: 'btn', id: 'wizard-next', onTap: createPin }, 'Start'),
    );
  };

  const createPin = (): void => {
    clear(body);
    const entry = newPinFlow((value) => {
      pin = value;
      showCode();
    });
    const pad = pinPad('Choose a 4-digit PIN', (value) => {
      pad.reset();
      entry(value, pad);
    });
    body.append(pad.el);
  };

  const showCode = (): void => {
    clear(body);
    let saved = false;
    const next = h('button', { class: 'btn', id: 'wizard-next', disabled: true, onTap: chooseLimit }, 'Next');
    const box = h('div', { class: 'box', html: '' });
    const check = h(
      'button',
      {
        class: 'check', id: 'saved-code',
        onTap: () => {
          saved = !saved;
          check.classList.toggle('on', saved);
          box.innerHTML = saved ? icon('check') : '';
          next.disabled = !saved;
        },
      },
      box,
      "I've saved this code",
    );
    body.append(
      h('h2', {}, 'Your recovery code'),
      h('p', {}, 'If you forget your PIN, this code gets you back in. Write it down somewhere safe. It will not be shown again.'),
      h('div', { class: 'code' }, code),
      check,
      next,
    );
  };

  const chooseLimit = (): void => {
    clear(body);
    const failure = h('div', { class: 'pin-msg' });
    const finish = async (): Promise<void> => {
      if (await app.finishSetup(pin, code, dailyLimit)) return;
      failure.textContent = 'Could not save the PIN. Open the game from its https:// address, or free up some storage.';
    };
    body.append(
      h('h2', {}, 'How long each day?'),
      h('p', {}, 'You can change this, and add play hours, breaks and more, in the Parent Zone.'),
      h(
        'div',
        { class: 'setting', style: { width: '100%' } },
        'Daily play time',
        stepper(DAILY_OPTIONS, () => dailyLimit, minutesFormat, (v) => {
          dailyLimit = v;
        }),
      ),
      failure,
      h('button', { class: 'btn', id: 'wizard-finish', html: icon('check'), onTap: () => void finish() }, 'All done'),
    );
  };

  intro();
  return root;
}

/* ---------- PIN gate (13.2) ---------- */

export function pinGateScreen(app: App, after: () => void): HTMLElement {
  const pad = pinPad('Grown-ups only', (pin) => {
    pad.reset();
    void app.parental.verifyPin(pin).then((result) => {
      if (result.ok) {
        after();
        return;
      }
      app.audio.sfx('wrongPin');
      pad.shake();
      const wait = result.lockedForSec ?? 0;
      pad.message(wait > 0 ? `Too many tries. Wait ${formatClock(wait)}` : 'Not right. Try again');
    }, () => pad.message(PIN_UNAVAILABLE));
  });
  return h(
    'div',
    { class: 'screen deep center', id: 'pin-gate' },
    pad.el,
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn ghost small', html: icon('close'), label: 'Cancel', onTap: () => app.route() }),
      h('button', { class: 'btn ghost small', id: 'forgot', onTap: () => app.show(recoveryScreen, after) }, 'Forgot PIN'),
    ),
  );
}

export function recoveryScreen(app: App, after: () => void): HTMLElement {
  const body = h('div', { class: 'wizard' });

  const pickNewPin = (code: string): void => {
    clear(body);
    const entry = newPinFlow((value) => {
      void app.parental.resetPinWithRecovery(code, value).then((result) => {
        if (result.ok) after();
        else enterCode('That code is not right');
      }, () => pad.message(PIN_UNAVAILABLE));
    });
    const pad = pinPad('Choose a new PIN', (value) => {
      pad.reset();
      entry(value, pad);
    });
    body.append(pad.el);
  };

  const enterCode = (message: string): void => {
    clear(body);
    const input = h('input', { class: 'code-input', label: 'Recovery code' }) as HTMLInputElement;
    input.autocomplete = 'off';
    input.maxLength = 9;
    body.append(
      h('h2', {}, 'Enter your recovery code'),
      input,
      h('div', { class: 'pin-msg' }, message),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn small', onTap: () => pickNewPin(input.value) }, 'Next'),
        h('button', { class: 'btn ghost small', onTap: () => app.route() }, 'Cancel'),
      ),
    );
  };

  enterCode('');
  return h('div', { class: 'screen deep center' }, body);
}

/* ---------- Parent Zone dashboard (13.3) ---------- */

function row(label: string, control: Node): HTMLElement {
  return h('div', { class: 'pz-row' }, h('span', {}, label), control);
}

function usageChart(app: App): HTMLElement {
  const days = app.parental.usageHistory(14);
  const peak = Math.max(1800, ...days.map((d) => d.activeSec));
  return h(
    'div',
    { class: 'usage' },
    ...days.map((d) =>
      h(
        'div',
        { class: 'day', title: `${Math.round(d.activeSec / 60)} min` },
        h('div', { class: `bar${d.clockChanged ? ' flag' : ''}`, style: { height: `${(d.activeSec / peak) * 100}%` } }),
        d.dayKey.slice(-2),
      ),
    ),
  );
}

function segmented<T extends string>(options: [T, string][], current: () => T, write: (v: T) => void, attr: string): HTMLElement {
  const buttons = options.map(([value, label]) => {
    const btn = h(
      'button',
      {
        class: current() === value ? 'on' : '', dataset: { [attr]: value },
        onTap: () => {
          write(value);
          buttons.forEach((b, i) => b.classList.toggle('on', options[i]![0] === value));
        },
      },
      label,
    );
    return btn;
  });
  return h('div', { class: 'segmented' }, ...buttons);
}

export function parentScreen(app: App): HTMLElement {
  const { parental, save } = app;
  const p = (): ReturnType<typeof save.get>['parental'] => save.get().parental;
  const set = (patch: Parameters<typeof parental.updateSettings>[0]): void => void parental.updateSettings(patch);

  const statusText = h('p');
  const endBreak = h('button', { class: 'btn small coral hidden', id: 'end-break', onTap: () => void parental.endBreak().then(paintStatus) }, 'End the break');
  const paintStatus = (): void => {
    const s = parental.status();
    const today = Math.round(s.usedTodaySec / 60);
    const left = s.remainingSec === null ? ' No limit today.' : ` ${Math.ceil(s.remainingSec / 60)} min left.`;
    const blocked = { ok: '', daily: '', break: ' On a break: extra time starts after it ends.', window: ' Outside play hours: extra time starts when they open.' };
    statusText.textContent = `Played ${today} min today.${left}${blocked[s.reason]}`;
    endBreak.classList.toggle('hidden', s.breakRemainingSec === 0);
  };
  paintStatus();
  const grant = (amount: GrantAmount): void => {
    void parental.grant(amount).then(paintStatus);
    app.audio.sfx('unlock');
  };

  const windowStart = h('input', { class: 'time-input', label: 'Play window start' }) as HTMLInputElement;
  const windowEnd = h('input', { class: 'time-input', label: 'Play window end' }) as HTMLInputElement;
  windowStart.type = 'time';
  windowEnd.type = 'time';
  windowStart.value = p().playWindow?.start ?? '07:00';
  windowEnd.value = p().playWindow?.end ?? '19:30';
  const windowOn = h('button', { class: `toggle${p().playWindow ? ' on' : ''}`, label: 'Play window' });
  const windowNote = h('div', { class: 'pin-msg' });
  const applyWindow = (): void => {
    void parental.updateSettings({ playWindow: windowOn.classList.contains('on') ? { start: windowStart.value, end: windowEnd.value } : null }).then((saved) => {
      windowNote.textContent = saved ? '' : 'Those play hours were not saved: pick a start and an end that differ.';
      if (saved) return;
      windowOn.classList.toggle('on', p().playWindow !== null);
      windowStart.value = p().playWindow?.start ?? '07:00';
      windowEnd.value = p().playWindow?.end ?? '19:30';
    });
  };
  windowOn.addEventListener('click', () => {
    windowOn.classList.toggle('on');
    applyWindow();
  });
  windowStart.addEventListener('change', applyWindow);
  windowEnd.addEventListener('change', applyWindow);

  const showTimer = h('button', { class: `toggle${p().showTimerToChild ? ' on' : ''}`, label: 'Show remaining time' });
  showTimer.addEventListener('click', () => {
    const on = !p().showTimerToChild;
    showTimer.classList.toggle('on', on);
    set({ showTimerToChild: on });
  });

  return h(
    'div',
    { class: 'screen deep', id: 'parent' },
    h(
      'div',
      { class: 'topbar' },
      h('h1', {}, 'Parent Zone'),
      h('button', { class: 'btn small sea', id: 'pz-close', html: icon('check'), label: 'Done', onTap: () => app.closeParentZone() }),
    ),
    save.saveError !== null && h('div', { class: 'pin-msg', id: 'save-warning' }, 'The game could not save lately, so progress and play time may be lost. Free up some storage on this device.'),
    h(
      'div',
      { class: 'scroll' },
      h(
        'div',
        { class: 'pz-grid' },
        h(
          'div',
          { class: 'pz-card wide' },
          h('h3', {}, 'Today'),
          statusText,
          h(
            'div',
            { class: 'grant' },
            ...([10, 20, 30] as const).map((m) => h('button', { class: 'btn small', dataset: { grant: String(m) }, onTap: () => grant(m) }, `+${m} min`)),
            h('button', { class: 'btn small sea', dataset: { grant: 'unlimited' }, onTap: () => grant('unlimited') }, 'Rest of today'),
            endBreak,
          ),
        ),
        h(
          'div',
          { class: 'pz-card' },
          h('h3', {}, 'Play time'),
          row('Weekdays', stepper(DAILY_OPTIONS, () => p().dailyLimitMin, minutesFormat, (v) => set({ dailyLimitMin: v }))),
          row('Weekends', stepper(DAILY_OPTIONS, () => p().weekendLimitMin, (v) => (v === null ? 'Same' : `${v} min`), (v) => set({ weekendLimitMin: v }))),
          row('Session', stepper([null, ...range(10, 60, 5)], () => p().sessionLimitMin, minutesFormat, (v) => set({ sessionLimitMin: v }))),
          row('Show timer to child', showTimer),
        ),
        h(
          'div',
          { class: 'pz-card' },
          h('h3', {}, 'Breaks and hours'),
          row('Break every', stepper([null, 15, 20, 30], () => p().breakEveryMin, minutesFormat, (v) => set({ breakEveryMin: v }))),
          row('Break length', stepper([2, 5, 10], () => p().breakLengthMin, minutesFormat, (v) => set({ breakLengthMin: v }))),
          row('Play hours', windowOn),
          h('div', { class: 'pz-row' }, windowStart, 'to', windowEnd),
          row('New day starts', stepper(['00:00', '01:00', '02:00', '03:00', '04:00', '05:00'], () => p().dayResetTime, (v) => v, (v) => set({ dayResetTime: v }))),
        ),
        h(
          'div',
          { class: 'pz-card wide' },
          h('h3', {}, 'Difficulty'),
          segmented<'child' | Difficulty>(
            [['child', 'Child chooses'], ...DIFFICULTIES.map((d) => [d, d[0]!.toUpperCase() + d.slice(1)] as ['child' | Difficulty, string])],
            () => p().difficultyLock ?? 'child',
            (v) => set({ difficultyLock: v === 'child' ? null : v }),
            'lock',
          ),
        ),
        h('div', { class: 'pz-card wide' }, h('h3', {}, 'Last 14 days'), usageChart(app), h('p', { class: 'note' }, 'A red bar means the iPad clock was changed that day.')),
        h(
          'div',
          { class: 'pz-card' },
          h('h3', {}, 'Security'),
          h('button', { class: 'btn small ghost', onTap: () => app.show(changePinScreen) }, 'Change PIN'),
          h(
            'button',
            {
              class: 'btn small coral',
              onTap: () =>
                app.confirm('Reset game progress?', 'Coins, levels and the Fish Book will be wiped. Your PIN and limits stay.', () =>
                  app.confirm('Are you sure?', 'This cannot be undone.', () => void parental.resetProgress().then(() => app.afterReset())),
                ),
            },
            'Reset game progress',
          ),
        ),
        h(
          'div',
          { class: 'pz-card' },
          h('h3', {}, 'Recommended iPad setup'),
          h('p', {}, 'Add the game to your Home Screen and always open it from there.'),
          h('p', {}, 'Turn on Guided Access (Settings, Accessibility, Guided Access) to lock the iPad to the game. It blocks the home swipe and has its own time limit.'),
          h('p', {}, 'Use Screen Time as a device-level backstop. This PIN is a child-proof lock, not a security boundary: clearing website data removes it.'),
        ),
      ),
    ),
  );
}

export function changePinScreen(app: App): HTMLElement {
  let current = '';
  const entry = newPinFlow((value) => {
    void app.parental.changePin(current, value).then(() => app.show(parentScreen), () => pad.message(PIN_UNAVAILABLE));
  });
  const pad = pinPad('Current PIN', (value) => {
    pad.reset();
    if (current === '') {
      void app.parental.verifyPin(value).then((result) => {
        if (!result.ok) {
          app.audio.sfx('wrongPin');
          pad.message('Not right. Try again');
          pad.shake();
          return;
        }
        current = value;
        pad.message('Choose a new PIN');
      }, () => pad.message(PIN_UNAVAILABLE));
      return;
    }
    entry(value, pad);
  });
  return h(
    'div',
    { class: 'screen deep center' },
    pad.el,
    h('button', { class: 'btn ghost small', html: icon('close'), label: 'Cancel', onTap: () => app.show(parentScreen) }),
  );
}

/* ---------- Time's up / Break / Reef is sleeping (S14) ---------- */

/** Shown instead of the wizard when the save exists but cannot be read. Saving is off, so the real save stays safe. */
export function saveErrorScreen(): HTMLElement {
  return h(
    'div',
    { class: 'screen deep center', id: 'save-error' },
    otto('sleep', 170),
    h('h2', {}, 'The reef needs a moment'),
    h('p', {}, 'Your saved game could not be opened. Nothing is lost.'),
    h('button', { class: 'btn', id: 'save-retry', onTap: () => location.reload() }, 'Try again'),
  );
}

export function blockedScreen(app: App): HTMLElement {
  const status = app.parental.status();
  const title = h('h2');
  const line = h('p');
  const countdown = h('div', { class: 'countdown hidden' });
  const activity = h('div', { class: 'activity hidden' }, 'Time to stretch and have a drink of water');

  const paint = (): void => {
    const s = app.parental.status();
    if (s.allowed) {
      app.route();
      return;
    }
    if (s.reason === 'break') {
      title.textContent = 'Break time!';
      line.textContent = 'Back in';
      countdown.textContent = formatClock(s.breakRemainingSec);
      countdown.classList.remove('hidden');
      activity.classList.remove('hidden');
    } else if (s.reason === 'window') {
      title.textContent = 'The reef is sleeping';
      line.textContent = 'Come back when it wakes up.';
    } else {
      title.textContent = 'Great job!';
      line.textContent = 'The fish are sleeping now. Come back tomorrow.';
    }
  };
  paint();
  const timer = window.setInterval(paint, 1000);
  app.onLeave(() => window.clearInterval(timer));

  return h(
    'div',
    { class: `screen sleep center`, id: 'blocked', dataset: { reason: status.reason } },
    otto('sleep', Math.min(280, window.innerHeight * 0.4)),
    title,
    line,
    countdown,
    activity,
    h('button', { class: 'btn ghost small', id: 'grown-ups', onTap: () => app.openParentZone() }, 'Grown-ups'),
  );
}
