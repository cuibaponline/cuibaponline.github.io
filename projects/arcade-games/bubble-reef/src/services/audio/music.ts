// Offline music renderer.
//
// A single context holding every note would pull thousands of scheduled nodes on each render
// quantum. Instead the score is cut into short windows, each rendered in its own context, and
// overlap-added into a ring the length of the loop. Notes that ring past the end land on the
// start, and so does the reverb tail, so the seam is continuous by construction.

import type { MusicTrack } from './types';
import { COMPOSITIONS } from './compositions';
import { buildScore, loopSeconds, type Composition, type NoteEvent } from './score';
import { INST_TAIL, impulse, playNote } from './synth';
import { breathe, offlineContext, renderOffline } from './offline';

export const MUSIC_SAMPLE_RATE = 22050;

const WINDOW_SECONDS = 6;
const NOTE_SLICE_MS = 3;
const SAMPLE_SLICE = 1 << 17;
const TARGET_RMS = 0.105;
const PEAK_CEILING = 0.72;

export interface RenderOptions {
  isCancelled?: () => boolean;
  /** Render only these part indices (stem analysis). */
  onlyParts?: readonly number[];
  /** Skip loudness normalisation (stem analysis). */
  raw?: boolean;
  /** Silence one path (reverb balance analysis). */
  mute?: 'dry' | 'wet';
}

async function renderWindow(
  comp: Composition,
  events: readonly NoteEvent[],
  offset: number,
  dry: Float32Array<ArrayBuffer>,
  send: Float32Array<ArrayBuffer>,
  sr: number,
): Promise<void> {
  const start = offset / sr;
  let end = start;
  for (const e of events) end = Math.max(end, e.t + e.dur + INST_TAIL[e.inst]);
  const frames = Math.ceil((end - start) * sr) + 1;
  const ctx = offlineContext(2, frames, sr);
  const merger = ctx.createChannelMerger(2);
  merger.connect(ctx.destination);
  const dryBus = ctx.createGain();
  dryBus.connect(merger, 0, 0);
  const sendBus = ctx.createGain();
  sendBus.connect(merger, 0, 1);

  const buses = new Map<number, GainNode>();
  const busFor = (part: number): GainNode => {
    let bus = buses.get(part);
    if (!bus) {
      bus = ctx.createGain();
      bus.connect(dryBus);
      const tap = ctx.createGain();
      tap.gain.value = comp.parts[part]?.send ?? 0;
      bus.connect(tap);
      tap.connect(sendBus);
      buses.set(part, bus);
    }
    return bus;
  };

  let slice = performance.now();
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!e) continue;
    playNote(ctx, busFor(e.part), e.inst, e.t - start, e.note, e.vel, e.dur);
    if (i % 8 === 7 && performance.now() - slice > NOTE_SLICE_MS) {
      await breathe();
      slice = performance.now();
    }
  }

  const rendered = await renderOffline(ctx);
  ringAdd(dry, rendered.getChannelData(0), offset);
  ringAdd(send, rendered.getChannelData(1), offset);
}

function ringAdd(ring: Float32Array, source: Float32Array, offset: number): void {
  const n = ring.length;
  for (let i = 0, at = offset % n; i < source.length; i++) {
    ring[at] = (ring[at] ?? 0) + (source[i] ?? 0);
    if (++at === n) at = 0;
  }
}

async function finish(
  comp: Composition,
  dry: Float32Array<ArrayBuffer>,
  send: Float32Array<ArrayBuffer>,
  sr: number,
  mute: RenderOptions['mute'],
) {
  const n = dry.length;
  const ctx = offlineContext(1, n + Math.round(comp.reverb.seconds * sr), sr);
  await breathe();

  const dryBuffer = ctx.createBuffer(1, n, sr);
  dryBuffer.copyToChannel(dry, 0);
  await breathe();
  const sendBuffer = ctx.createBuffer(1, n, sr);
  sendBuffer.copyToChannel(send, 0);
  await breathe();

  const clean = ctx.createBiquadFilter();
  clean.type = 'highpass';
  clean.frequency.value = 34;
  clean.Q.value = 0.5;
  clean.connect(ctx.destination);

  const drySrc = ctx.createBufferSource();
  drySrc.buffer = dryBuffer;
  if (mute !== 'dry') drySrc.connect(clean);

  const verb = ctx.createConvolver();
  verb.normalize = true;
  verb.buffer = impulse(ctx, comp.reverb.seconds, comp.reverb.damp);
  const wet = ctx.createGain();
  wet.gain.value = mute === 'wet' ? 0 : comp.reverb.wet;
  const sendSrc = ctx.createBufferSource();
  sendSrc.buffer = sendBuffer;
  sendSrc.connect(verb);
  verb.connect(wet);
  wet.connect(clean);

  drySrc.start(0);
  sendSrc.start(0);
  const rendered = await renderOffline(ctx);
  return { rendered, ctx };
}

async function loudness(data: Float32Array): Promise<{ peak: number; rms: number }> {
  let peak = 0;
  let sum = 0;
  for (let from = 0; from < data.length; from += SAMPLE_SLICE) {
    const to = Math.min(data.length, from + SAMPLE_SLICE);
    for (let i = from; i < to; i++) {
      const v = data[i] ?? 0;
      const abs = v < 0 ? -v : v;
      if (abs > peak) peak = abs;
      sum += v * v;
    }
    await breathe();
  }
  return { peak, rms: Math.sqrt(sum / data.length) };
}

/** Resolves null when cancelled. */
export async function renderTrack(track: MusicTrack, opts: RenderOptions = {}): Promise<AudioBuffer | null> {
  const comp = COMPOSITIONS[track];
  const sr = MUSIC_SAMPLE_RATE;
  const n = Math.round(loopSeconds(comp) * sr);
  const only = opts.onlyParts;
  const events = buildScore(comp).filter((e) => !only || only.includes(e.part));
  const dry = new Float32Array(n);
  const send = new Float32Array(n);

  for (let index = 0; ; index++) {
    const from = index * WINDOW_SECONDS;
    if (from >= n / sr) break;
    const chunk = events.filter((e) => e.t >= from && e.t < from + WINDOW_SECONDS);
    if (chunk.length > 0) await renderWindow(comp, chunk, Math.round(from * sr), dry, send, sr);
    if (opts.isCancelled?.()) return null;
    await breathe();
  }

  const { rendered, ctx } = await finish(comp, dry, send, sr, opts.mute);
  if (opts.isCancelled?.()) return null;

  const out = new Float32Array(n);
  const data = rendered.getChannelData(0);
  out.set(data.subarray(0, n));
  ringAdd(out, data.subarray(n), 0);
  await breathe();

  if (!opts.raw) {
    const { peak, rms } = await loudness(out);
    const scale = Math.min((TARGET_RMS * comp.level) / Math.max(rms, 1e-6), PEAK_CEILING / Math.max(peak, 1e-6));
    for (let from = 0; from < n; from += SAMPLE_SLICE) {
      const to = Math.min(n, from + SAMPLE_SLICE);
      for (let i = from; i < to; i++) out[i] = (out[i] ?? 0) * scale;
      await breathe();
    }
  }

  const buffer = ctx.createBuffer(1, n, sr);
  await breathe();
  buffer.copyToChannel(out, 0);
  return buffer;
}
