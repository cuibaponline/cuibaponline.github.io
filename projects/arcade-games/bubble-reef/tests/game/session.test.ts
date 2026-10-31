import { describe, expect, it, vi } from 'vitest';
import { GameSession, type SessionDeps } from '../../src/game/session';
import { createDefaultSave, type SaveData } from '../../src/services/saveSchema';
import { VIEW } from '../sim/helpers';

function rig(): { session: GameSession; deps: SessionDeps; ended: ReturnType<typeof vi.fn>; world: { keepOceans: ReturnType<typeof vi.fn>; prepareOcean: ReturnType<typeof vi.fn> } } {
  const data: SaveData = createDefaultSave();
  const ended = vi.fn();
  const world = { currentLayout: { view: VIEW }, keepOceans: vi.fn(), prepareOcean: vi.fn(), setOcean: vi.fn() };
  const noop = (): void => {};
  const deps = {
    world,
    hud: new Proxy({}, { get: () => noop }),
    input: { release: noop, setFireButton: noop },
    audio: new Proxy({}, { get: () => noop }),
    save: { get: () => data, update: (fn: (d: SaveData) => void) => fn(data), saveSoon: noop, saveNow: () => Promise.resolve() },
    onPause: noop,
    onWaveComplete: noop,
    onEnded: ended,
  } as unknown as SessionDeps;
  return { session: new GameSession(deps, 'easy', 42), deps, ended, world };
}

describe('GameSession wrap-up', () => {
  it('moves to the wrap-up on the last catch without ending yet', () => {
    const { session, ended } = rig();
    session.beginLastCatch();
    session.frame(16);
    expect(session.sim.s.phase).toBe('wrapUp');
    expect(ended).not.toHaveBeenCalled();
  });

  it('ends straight away when a limit lands at the intermission', () => {
    const { session, ended } = rig();
    session.onEvents([{ t: 'waveComplete', wave: 1, shots: 1, hits: 1 }]);
    expect(session.atIntermission).toBe(true);
    session.beginLastCatch();
    expect(ended).toHaveBeenCalledOnce();
  });

  it('ends a paused session without waiting for the fish', () => {
    const { session, ended } = rig();
    session.paused = true;
    session.beginLastCatch();
    session.frame(16);
    expect(ended).toHaveBeenCalledOnce();
  });

  it('hands back results only once', () => {
    const { session, ended } = rig();
    session.finish();
    session.finish();
    expect(ended).toHaveBeenCalledOnce();
  });
});

describe('GameSession oceans', () => {
  it('keeps only the current and next ocean', () => {
    const { session, world } = rig();
    session.sim.setUnlocks({ ...session.sim.s.unlocks, oceans: ['coral', 'kelp', 'ship'] });
    session.sim.s.oceanIndex = 2;
    session.prepareOceans();
    expect(world.keepOceans).toHaveBeenCalledWith([session.currentOcean, 'coral']);
    expect(world.prepareOcean).toHaveBeenCalledWith('coral');
  });
});
