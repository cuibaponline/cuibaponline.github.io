// Numeric audio checks, driven from Playwright WebKit or by hand at /tools/audio-check.html.
// Nothing here can judge how the music sounds; it only measures.

import { AudioService } from '../src/services/audio';
import { MUSIC_TRACKS, SFX_NAMES, type MusicTrack, type SfxName } from '../src/services/audio/types';
import { COMPOSITIONS } from '../src/services/audio/compositions';
import { MUSIC_SAMPLE_RATE, renderTrack } from '../src/services/audio/music';
import { SFX_SAMPLE_RATE, renderLaser, renderSfx } from '../src/services/audio/sfx';
import { buildGraph } from '../src/services/audio/graph';
import { buildScore, loopSeconds, parseChords, parseLine, type Composition, type LinePart } from '../src/services/audio/score';

const out = document.getElementById('out') as HTMLPreElement;
const show = (value: unknown) => {
  out.textContent = JSON.stringify(value, null, 1);
};
const round = (v: number, places = 4) => Number(v.toFixed(places));
const db = (v: number) => round(20 * Math.log10(Math.max(v, 1e-9)), 1);
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] ?? 0, re[i] ?? 0];
      [im[i], im[j]] = [im[j] ?? 0, im[i] ?? 0];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const step = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(step * k);
        const s = Math.sin(step * k);
        const a = i + k;
        const b = a + len / 2;
        const tr = (re[b] ?? 0) * c - (im[b] ?? 0) * s;
        const ti = (re[b] ?? 0) * s + (im[b] ?? 0) * c;
        re[b] = (re[a] ?? 0) - tr;
        im[b] = (im[a] ?? 0) - ti;
        re[a] = (re[a] ?? 0) + tr;
        im[a] = (im[a] ?? 0) + ti;
      }
    }
  }
}

function spectrum(data: Float32Array, sr: number) {
  const size = 4096;
  const frames = Math.max(1, Math.min(120, Math.floor(data.length / size)));
  const hop = Math.max(size, Math.floor((data.length - size) / frames));
  const power = new Float64Array(size / 2);
  for (let f = 0; f < frames; f++) {
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < size; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
      re[i] = (data[f * hop + i] ?? 0) * w;
    }
    fft(re, im);
    for (let k = 0; k < size / 2; k++) power[k] = (power[k] ?? 0) + (re[k] ?? 0) ** 2 + (im[k] ?? 0) ** 2;
  }
  let total = 0;
  let weighted = 0;
  const bands = { sub: 0, low: 0, mid: 0, presence: 0, air: 0 };
  for (let k = 0; k < size / 2; k++) {
    const hz = (k * sr) / size;
    const p = power[k] ?? 0;
    total += p;
    weighted += p * hz;
    if (hz < 80) bands.sub += p;
    else if (hz < 500) bands.low += p;
    else if (hz < 2000) bands.mid += p;
    else if (hz < 6000) bands.presence += p;
    else bands.air += p;
  }
  const pct = (v: number) => round((100 * v) / Math.max(total, 1e-12), 1);
  return {
    centroidHz: Math.round(weighted / Math.max(total, 1e-12)),
    pctSub80: pct(bands.sub),
    pctLow: pct(bands.low),
    pctMid: pct(bands.mid),
    pctPresence2k6k: pct(bands.presence),
    pctAir6k: pct(bands.air),
  };
}

function levels(data: Float32Array) {
  let peak = 0;
  let sum = 0;
  let dc = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i] ?? 0;
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
    dc += v;
  }
  const rms = Math.sqrt(sum / data.length);
  return { peak: round(peak), rms: round(rms), rmsDb: db(rms), crestDb: db(peak / Math.max(rms, 1e-9)), dc: round(dc / data.length, 6) };
}

/** One-second RMS over the loop: a section that jumps out or drops away shows up here. */
function loudnessRange(data: Float32Array, sr: number) {
  const size = Math.round(sr);
  const values: number[] = [];
  for (let from = 0; from + size <= data.length; from += size) {
    let sum = 0;
    for (let i = from; i < from + size; i++) sum += (data[i] ?? 0) ** 2;
    values.push(Math.sqrt(sum / size));
  }
  values.sort((a, b) => a - b);
  const low = values[Math.floor(values.length * 0.05)] ?? 0;
  const high = values[Math.floor(values.length * 0.95)] ?? 0;
  return { shortTermRangeDb: db(high / Math.max(low, 1e-9)), shortTermMaxDb: db(values[values.length - 1] ?? 0) };
}

function seam(data: Float32Array, sr: number) {
  const n = data.length;
  const around = Math.round(sr);
  const deltas: number[] = [];
  for (let i = n - around; i < n - 1; i++) deltas.push(Math.abs((data[i + 1] ?? 0) - (data[i] ?? 0)));
  for (let i = 0; i < around; i++) deltas.push(Math.abs((data[i + 1] ?? 0) - (data[i] ?? 0)));
  deltas.sort((a, b) => a - b);
  const p50 = deltas[Math.floor(deltas.length * 0.5)] ?? 0;
  const p999 = deltas[Math.floor(deltas.length * 0.999)] ?? 0;
  const max = deltas[deltas.length - 1] ?? 0;
  const seamDelta = Math.abs((data[0] ?? 0) - (data[n - 1] ?? 0));
  // Second difference across the join; a click shows up here even on a loud passage.
  const curve = Math.abs((data[n - 2] ?? 0) - 2 * (data[n - 1] ?? 0) + (data[0] ?? 0));
  const part = (from: number, to: number) => {
    let s = 0;
    for (let i = from; i < to; i++) s += (data[i] ?? 0) ** 2;
    return Math.sqrt(s / (to - from));
  };
  const ms50 = Math.round(sr * 0.05);
  const before = part(n - ms50, n);
  const after = part(0, ms50);
  // Negative control: the metric should light up on a splice that doesn't belong.
  const a = data[Math.floor(n / 3)] ?? 0;
  let control = 0;
  for (let i = 1; i < 400; i++) {
    control = Math.max(control, Math.abs(a - (data[Math.floor(n * 0.71) + i * 37] ?? 0)));
  }
  return {
    seamDelta: round(seamDelta, 5),
    seamCurve: round(curve, 5),
    p50Delta: round(p50, 5),
    p999Delta: round(p999, 5),
    maxDelta: round(max, 5),
    seamVsP999: round(seamDelta / Math.max(p999, 1e-9), 3),
    rms50msBefore: round(before),
    rms50msAfter: round(after),
    joinStepDb: db(after / Math.max(before, 1e-9)),
    lastSecondRms: round(part(n - around, n)),
    firstSecondRms: round(part(0, around)),
    worstRandomSpliceDelta: round(control, 4),
  };
}

/** Longest gap between main-thread tasks while `work` runs. */
async function watchStalls<T>(work: () => Promise<T>): Promise<{ result: T; ms: number; longestStallMs: number }> {
  let longest = 0;
  let last = performance.now();
  let running = true;
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    const now = performance.now();
    longest = Math.max(longest, now - last);
    last = now;
    if (running) channel.port2.postMessage(0);
  };
  channel.port2.postMessage(0);
  const start = performance.now();
  const result = await work();
  const ms = performance.now() - start;
  running = false;
  return { result, ms: round(ms, 1), longestStallMs: round(longest, 1) };
}

async function checkSfx() {
  const rows: Record<string, unknown> = {};
  let totalBytes = 0;
  let totalMs = 0;
  let worstStall = 0;
  for (const name of SFX_NAMES) {
    const { result, ms, longestStallMs } = await watchStalls(() => renderSfx(name));
    totalMs += ms;
    worstStall = Math.max(worstStall, longestStallMs);
    const buffers = result;
    const first = buffers[0];
    if (!first) continue;
    const data = first.getChannelData(0);
    let tail = 0;
    for (let i = data.length - 16; i < data.length; i++) tail = Math.max(tail, Math.abs(data[i] ?? 0));
    let head = 0;
    for (let i = 0; i < 8; i++) head = Math.max(head, Math.abs(data[i] ?? 0));
    // Level just before the closing fade: anything loud here means the sound was cut off.
    const cutFrom = data.length - Math.round(0.042 * SFX_SAMPLE_RATE);
    const cutTo = data.length - Math.round(0.012 * SFX_SAMPLE_RATE);
    let cut = 0;
    for (let i = cutFrom; i < cutTo; i++) cut = Math.max(cut, Math.abs(data[i] ?? 0));
    totalBytes += buffers.reduce((sum, b) => sum + b.length * 4, 0);
    rows[name] = {
      variants: buffers.length,
      seconds: round(first.duration, 3),
      renderMs: ms,
      longestStallMs,
      ...levels(data),
      lastSamples: round(tail, 5),
      firstSamples: round(head, 5),
      preFadeDb: db(cut / Math.max(levels(data).peak, 1e-9)),
      ...spectrum(data, SFX_SAMPLE_RATE),
    };
  }
  return { rows, totalMs: round(totalMs, 1), totalKB: Math.round(totalBytes / 1024), worstStallMs: worstStall };
}

async function checkMusic() {
  const rows: Record<string, unknown> = {};
  for (const track of MUSIC_TRACKS) {
    const comp = COMPOSITIONS[track];
    const { result, ms, longestStallMs } = await watchStalls(() => renderTrack(track));
    if (!result) continue;
    const data = result.getChannelData(0);
    rows[track] = {
      key: comp.key,
      bpm: comp.bpm,
      meter: comp.meter,
      bars: comp.bars,
      notes: buildScore(comp).length,
      seconds: round(result.duration, 2),
      channels: result.numberOfChannels,
      sampleRate: result.sampleRate,
      megabytes: round((result.length * 4) / (1024 * 1024), 2),
      renderMs: ms,
      realtimeFactor: round(result.duration / (ms / 1000), 1),
      longestStallMs,
      ...levels(data),
      ...loudnessRange(data, MUSIC_SAMPLE_RATE),
      ...spectrum(data, MUSIC_SAMPLE_RATE),
      seam: seam(data, MUSIC_SAMPLE_RATE),
    };
    show({ music: track });
    await wait(0);
  }
  return rows;
}

async function checkReverb(track: MusicTrack) {
  const dry = await renderTrack(track, { raw: true, mute: 'wet' });
  const wet = await renderTrack(track, { raw: true, mute: 'dry' });
  if (!dry || !wet) return null;
  return db(levels(wet.getChannelData(0)).rms / levels(dry.getChannelData(0)).rms);
}

async function checkStems(track: MusicTrack) {
  const comp = COMPOSITIONS[track];
  const whole = await renderTrack(track, { raw: true });
  if (!whole) return null;
  const wholeRms = levels(whole.getChannelData(0)).rms;
  const rows: Record<string, unknown> = {};
  for (let i = 0; i < comp.parts.length; i++) {
    const buffer = await renderTrack(track, { raw: true, onlyParts: [i] });
    if (!buffer) continue;
    const data = buffer.getChannelData(0);
    const l = levels(data);
    rows[comp.parts[i]?.name ?? String(i)] = { relDb: db(l.rms / wholeRms), peakDb: db(l.peak / wholeRms) };
  }
  return rows;
}

// Melody against harmony: strong-beat notes outside the chord are the usual sign of a wrong note.
function checkHarmony(comp: Composition) {
  const spans = parseChords(comp);
  const line = comp.parts.find((p): p is LinePart => p.kind === 'line' && p.melody === true);
  if (!line) return null;
  const notes = parseLine(comp, line.notes);
  const pitched = notes.filter((n) => n.note !== null);
  const chordAt = (beat: number) => {
    for (let i = spans.length - 1; i >= 0; i--) {
      const span = spans[i];
      if (span && span.beat <= beat + 1e-6) return span;
    }
    return spans[0];
  };
  let onStrong = 0;
  let strongChordTones = 0;
  let allChordTones = 0;
  const offenders: string[] = [];
  const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  for (const n of pitched) {
    const span = chordAt(n.beat);
    if (!span || n.note === null) continue;
    const pc = n.note % 12;
    const tones = span.chord.tones.map((t) => (span.chord.root + t) % 12);
    if (span.chord.bass !== span.chord.root) tones.push(span.chord.bass);
    const inChord = tones.includes(pc);
    if (inChord) allChordTones++;
    const offset = n.beat % comp.meter;
    const strong = offset === 0 || (comp.meter === 4 && offset === 2);
    if (strong) {
      onStrong++;
      if (inChord) strongChordTones++;
    }
    // A minor ninth above a chord tone is the clash that hurts; short passing notes get away with it.
    const clash = tones.some((t) => (pc - t + 12) % 12 === 1);
    if (!inChord && clash && (strong || n.beats >= 1)) {
      offenders.push(`bar ${n.bar} ${names[pc]} on ${span.chord.symbol}`);
    }
  }
  const midiNotes = pitched.map((n) => n.note ?? 0);
  let biggestLeap = 0;
  for (let i = 1; i < midiNotes.length; i++) {
    biggestLeap = Math.max(biggestLeap, Math.abs((midiNotes[i] ?? 0) - (midiNotes[i - 1] ?? 0)));
  }
  const first = midiNotes[0] ?? 0;
  const last = midiNotes[midiNotes.length - 1] ?? 0;
  const lastSpan = spans[spans.length - 1];
  const firstSpan = spans[0];
  return {
    notes: pitched.length,
    strongBeatChordTonePct: round((100 * strongChordTones) / Math.max(onStrong, 1), 1),
    allChordTonePct: round((100 * allChordTones) / Math.max(pitched.length, 1), 1),
    minorNinthClashes: offenders,
    rangeMidi: [Math.min(...midiNotes), Math.max(...midiNotes)],
    biggestLeapSemitones: biggestLeap,
    wrapLeapSemitones: Math.abs(first - last),
    wrapChords: `${lastSpan?.chord.symbol} -> ${firstSpan?.chord.symbol}`,
    seconds: round(loopSeconds(comp), 1),
  };
}

// Worst case: music and every effect at full volume, all landing on the same sample, through the real chain.
async function stress(music: MusicTrack, repeat: number, musicVolume: number, sfxVolume: number, voiceGain = 1) {
  const buffers = await Promise.all(SFX_NAMES.map((n) => renderSfx(n)));
  const track = await renderTrack(music);
  if (!track) return null;
  const sr = 48000;
  const seconds = 4;
  const ctx = new OfflineAudioContext(1, sr * seconds, sr);
  const graph = buildGraph(ctx, musicVolume, sfxVolume);
  const loop = ctx.createBufferSource();
  loop.buffer = track;
  loop.loop = true;
  loop.connect(graph.musicIn);
  loop.start(0);
  let voices = 0;
  for (let r = 0; r < repeat; r++) {
    for (const set of buffers) {
      const buffer = set[0];
      if (!buffer || voices >= 16 * repeat) continue;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = voiceGain;
      src.connect(gain);
      gain.connect(graph.sfxBus);
      src.start(0.5 + r * 0.25);
      voices++;
    }
  }
  const data = (await ctx.startRendering()).getChannelData(0);
  return { voices, ...levels(data), musicVolume, sfxVolume, voiceGain };
}

// The shipping path: a 22.05 kHz buffer looped by a source node in a 48 kHz context, seam mid-render.
async function checkLiveLoop(track: MusicTrack) {
  const buffer = await renderTrack(track);
  if (!buffer) return null;
  const sr = 48000;
  const lead = 1.5;
  const ctx = new OfflineAudioContext(1, sr * 3, sr);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(ctx.destination);
  src.start(0, buffer.duration - lead);
  const data = (await ctx.startRendering()).getChannelData(0);
  const join = Math.round(lead * sr);
  const deltas: number[] = [];
  let atJoin = 0;
  for (let i = 1; i < data.length; i++) {
    const d = Math.abs((data[i] ?? 0) - (data[i - 1] ?? 0));
    if (Math.abs(i - join) <= 6) atJoin = Math.max(atJoin, d);
    else deltas.push(d);
  }
  deltas.sort((a, b) => a - b);
  const p999 = deltas[Math.floor(deltas.length * 0.999)] ?? 0;
  return {
    atJoin: round(atJoin, 5),
    p999: round(p999, 5),
    max: round(deltas[deltas.length - 1] ?? 0, 5),
    joinVsP999: round(atJoin / Math.max(p999, 1e-9), 3),
  };
}

async function wavBase64(kind: 'music' | 'sfx', name: string): Promise<string | null> {
  const buffer = kind === 'music' ? await renderTrack(name as MusicTrack) : (await renderSfx(name as SfxName))[0];
  if (!buffer) return null;
  const data = buffer.getChannelData(0);
  const bytes = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(bytes);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + data.length * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) {
    view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, data[i] ?? 0)) * 32767), true);
  }
  let binary = '';
  const raw = new Uint8Array(bytes);
  for (let i = 0; i < raw.length; i += 0x8000) binary += String.fromCharCode(...raw.subarray(i, i + 0x8000));
  return btoa(binary);
}

// Live output tap: every connection to the destination is mirrored into an analyser.
interface Tap {
  ctx: AudioContext | null;
  analyser: AnalyserNode | null;
  sourcesStarted: number;
}
const tap: Tap = { ctx: null, analyser: null, sourcesStarted: 0 };

// Captured now: the fallback checks take the global away while this tap is still installed.
const RealtimeContext = AudioContext;
const nativeConnect = AudioNode.prototype.connect as (...args: unknown[]) => unknown;
AudioNode.prototype.connect = function patched(this: AudioNode, ...args: unknown[]): unknown {
  const result = nativeConnect.apply(this, args);
  if (args[0] instanceof AudioDestinationNode && this.context instanceof RealtimeContext) {
    const ctx = this.context;
    if (tap.ctx !== ctx) {
      tap.ctx = ctx;
      tap.analyser = ctx.createAnalyser();
      tap.analyser.fftSize = 2048;
      tap.analyser.smoothingTimeConstant = 0;
    }
    if (tap.analyser) nativeConnect.call(this, tap.analyser);
  }
  return result;
} as typeof AudioNode.prototype.connect;

const nativeStart = AudioBufferSourceNode.prototype.start;
AudioBufferSourceNode.prototype.start = function patched(this: AudioBufferSourceNode, ...args) {
  if (this.context instanceof RealtimeContext) tap.sourcesStarted++;
  return nativeStart.apply(this, args);
};

async function outputLevel(ms: number) {
  const analyser = tap.analyser;
  if (!analyser) return { rms: 0, peak: 0, highPct: 0 };
  const frame = new Float32Array(analyser.fftSize);
  const bins = new Float32Array(analyser.frequencyBinCount);
  const end = performance.now() + ms;
  let sum = 0;
  let count = 0;
  let peak = 0;
  let high = 0;
  let all = 0;
  const hzPerBin = analyser.context.sampleRate / analyser.fftSize;
  while (performance.now() < end) {
    analyser.getFloatTimeDomainData(frame);
    for (const v of frame) {
      sum += v * v;
      peak = Math.max(peak, Math.abs(v));
    }
    count += frame.length;
    analyser.getFloatFrequencyData(bins);
    bins.forEach((value, k) => {
      if (!Number.isFinite(value)) return;
      const p = 10 ** (value / 10);
      all += p;
      if (k * hzPerBin > 1200) high += p;
    });
    await wait(30);
  }
  return {
    rms: round(Math.sqrt(sum / Math.max(count, 1)), 5),
    peak: round(peak),
    highPct: round((100 * high) / Math.max(all, 1e-15), 2),
  };
}

const service = new AudioService();
const unlockButton = document.getElementById('unlock') as HTMLButtonElement;
unlockButton.addEventListener('click', () => {
  void service.unlock();
  service.sfx('buttonTap');
});

const offlineButton = document.getElementById('offline') as HTMLButtonElement;
offlineButton.addEventListener('click', () => {
  void api.offline().then(show);
});

const api = {
  service,
  tap,
  outputLevel,
  show,
  wait,
  wavBase64,
  stress,
  checkStems,
  checkReverb,
  checkLiveLoop,
  renderSfx,
  renderLaser: () => renderLaser(new OfflineAudioContext(1, 1, SFX_SAMPLE_RATE)),
  seam,
  levels,
  harmony: () => Object.fromEntries(MUSIC_TRACKS.map((t) => [t, checkHarmony(COMPOSITIONS[t])])),
  checkSfx,
  checkMusic,
  async offline() {
    const sfx = await checkSfx();
    const music = await checkMusic();
    return { sfx, music, harmony: api.harmony() };
  },
};

Object.assign(window, { audioCheck: api });
show('ready');
