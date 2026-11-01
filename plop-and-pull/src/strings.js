// Every player-facing line, so Vietnamese can be added later as a second table.
const en = {
  title: 'Plop & Pull',
  tapToStart: 'Tap to start',
  levelNames: ['Sunny Shallows', 'Kelp Middle', 'The Deep'],
  locked: 'Locked',
  onePlayer: 'One boat',
  twoPlayers: 'Two boats',
  stickers: 'Stickers',
  settings: 'Grown-ups',
  back: 'Back',
  pause: 'Paused',
  resume: 'Resume',
  restart: 'Restart',
  home: 'Home',
  again: 'Again',
  next: 'Next',
  goodnight: 'Goodnight',
  newBest: 'New best!',
  best: 'Best {n}',
  nightTitle: 'Goodnight, little sea',
  nightBody: 'Every friend is home and asleep. Thank you for the rides!',
  newExtra: { flag: 'Your boat has a flag!', parasol: 'Your boat has a sunshade!', lights: 'Your boat has party lights!' },
  stickerLocked: 'Bring this friend up to get its sticker.',
  stickerProgress: '{n} of {total}',
  newSticker: 'New sticker: {name}!',
  music: 'Music',
  sfx: 'Sounds',
  resetHold: 'Hold for 3 seconds to reset progress',
  resetDone: 'Progress reset',
  memory: 'Picture memory: {n} MB',
  installTitle: 'Play full screen',
  installBody: 'Tap Share, then Add to Home Screen.',
  ok: 'OK',
  pauseLabel: 'Pause',
  turn: 'This game likes a tall screen',
  facts: {
    bobble: 'Pufferfish gulp water to puff up big and round.',
    stripes: 'Clownfish live safely among the stingers of sea anemones.',
    hoppa: 'Seahorse dads carry the babies in a little pouch.',
    boxy: 'Boxfish wear hard plates, like a suit of armour.',
    shelby: 'Sea turtles swim all the way back to a beach to lay their eggs.',
    glim: 'Many fish in the deep sea make their own light.',
    swoop: 'Manta rays are gentle giants that eat tiny plankton.',
    hum: 'Whales sing songs that travel a long way through the sea.',
    boot: 'Who lost this boot? It is full of sand now.',
    teapot: 'Tea for two, if the two are fish.',
    ducky: 'Thousands of rubber ducks once fell off a ship and floated for years.',
    sock: 'The other sock is still down there somewhere.',
  },
};

export const STRINGS = { en };

export function t(key, vars = {}) {
  const text = en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}

export const levelName = (level) => en.levelNames[level - 1];
export const extraLine = (id) => en.newExtra[id] ?? '';
export const fact = (id) => en.facts[id] ?? '';
