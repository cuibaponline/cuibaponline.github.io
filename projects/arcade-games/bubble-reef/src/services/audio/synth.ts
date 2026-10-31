// Instrument voices built from Web Audio nodes. Used inside OfflineAudioContexts only, so
// node counts here cost render time, never gameplay time.

export type Inst =
  | 'marimba'
  | 'kalimba'
  | 'bell'
  | 'glass'
  | 'musicbox'
  | 'epiano'
  | 'pluck'
  | 'pad'
  | 'bass'
  | 'pizz'
  | 'flute'
  | 'wood'
  | 'conga'
  | 'shaker'
  | 'drop';

export const hz = (midiNote: number): number => 440 * 2 ** ((midiNote - 69) / 12);

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noiseCache = new Map<number, AudioBuffer>();

export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx.sampleRate);
  if (cached) return cached;
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  const rnd = mulberry32(0xb0bb1e);
  for (let i = 0; i < data.length; i++) data[i] = rnd() * 2 - 1;
  noiseCache.set(ctx.sampleRate, buf);
  return buf;
}

const impulseCache = new Map<string, AudioBuffer>();

/** Darkening noise tail: -60 dB at `seconds`, losing top end as it decays. */
export function impulse(ctx: BaseAudioContext, seconds: number, damp: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const key = `${sr}:${seconds}:${damp}`;
  const cached = impulseCache.get(key);
  if (cached) return cached;
  const n = Math.round(seconds * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const data = buf.getChannelData(0);
  const rnd = mulberry32(0xec40 + Math.round(seconds * 100));
  const coef = (fc: number) => 1 - Math.exp((-2 * Math.PI * fc) / sr);
  const a0 = coef(damp);
  const a1 = coef(damp * 0.22);
  const k = Math.log(1000) / n;
  const pre = Math.round(0.016 * sr);
  let lp = 0;
  for (let i = pre; i < n; i++) {
    lp += (a0 + (a1 - a0) * (i / n)) * (rnd() * 2 - 1 - lp);
    data[i] = lp * Math.exp(-k * i);
  }
  impulseCache.set(key, buf);
  return buf;
}

function tone(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  f: number,
  amp: number,
  t60: number,
  attack = 0.002,
  cents = 0,
): void {
  if (f >= ctx.sampleRate * 0.45 || amp <= 0) return;
  const o = ctx.createOscillator();
  o.frequency.value = f;
  if (cents) o.detune.value = cents;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + attack);
  g.gain.exponentialRampToValueAtTime(amp * 0.001, t + attack + t60);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + attack + t60);
}

function held(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  dur: number,
  amp: number,
  attack: number,
  release: number,
): GainNode {
  const hold = Math.max(attack, dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + attack);
  g.gain.setValueAtTime(amp, t + hold);
  g.gain.linearRampToValueAtTime(0, t + hold + release);
  g.connect(dest);
  return g;
}

function osc(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  end: number,
  f: number,
  type: OscillatorType = 'sine',
  cents = 0,
): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  if (cents) o.detune.value = cents;
  o.connect(dest);
  o.start(t);
  o.stop(end);
  return o;
}

/** Sine glide with a pluck envelope: the raw material of every bubble. */
export function sweep(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  f0: number,
  f1: number,
  glide: number,
  amp: number,
  life: number,
  attack = 0.004,
): void {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + glide);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + attack);
  g.gain.exponentialRampToValueAtTime(amp * 0.001, t + attack + life);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + attack + life);
}

/** Filtered noise burst with a moving centre frequency. */
export function puff(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  type: BiquadFilterType,
  f0: number,
  f1: number,
  q: number,
  amp: number,
  life: number,
  attack = 0.002,
): void {
  const buffer = noiseBuffer(ctx);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f0, t);
  filter.frequency.exponentialRampToValueAtTime(f1, t + life);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + attack);
  g.gain.exponentialRampToValueAtTime(amp * 0.001, t + attack + life);
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  src.start(t, (t * 7.31) % 0.9);
  src.stop(t + attack + life);
}

/** Seconds of ring after a note's written end. Sizes the render windows. */
export const INST_TAIL: Record<Inst, number> = {
  marimba: 1.7,
  kalimba: 2.2,
  bell: 3.2,
  glass: 2.4,
  musicbox: 2.2,
  epiano: 1.4,
  pluck: 1.5,
  pad: 1.1,
  bass: 0.3,
  pizz: 1.1,
  flute: 0.4,
  wood: 0.15,
  conga: 0.4,
  shaker: 0.1,
  drop: 0.3,
};

export function playNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  inst: Inst,
  t: number,
  note: number,
  vel: number,
  dur: number,
): void {
  const f = hz(note);
  switch (inst) {
    case 'marimba': {
      const ring = Math.min(1.5, Math.max(0.35, 1.5 * Math.sqrt(220 / f)));
      tone(ctx, dest, t, f, vel, ring, 0.002);
      tone(ctx, dest, t, f * 3.93, vel * vel * 0.2, ring * 0.24, 0.0015);
      tone(ctx, dest, t, f * 9.7, vel * vel * 0.04, 0.05, 0.001);
      return;
    }
    case 'kalimba': {
      const ring = Math.min(2, Math.max(0.7, 2 * Math.sqrt(262 / f)));
      tone(ctx, dest, t, f, vel, ring, 0.0025);
      tone(ctx, dest, t, f * 2, vel * 0.1, ring * 0.45, 0.002);
      tone(ctx, dest, t, f * 5.43, vel * vel * 0.16, 0.16, 0.0015);
      tone(ctx, dest, t, f * 8.9, vel * vel * 0.04, 0.05, 0.001);
      return;
    }
    case 'bell': {
      tone(ctx, dest, t, f, vel, 2.9, 0.003);
      tone(ctx, dest, t, f * 2.76, vel * 0.22, 1.0, 0.002);
      tone(ctx, dest, t, f * 5.4, vel * 0.07, 0.32, 0.0015);
      return;
    }
    case 'glass': {
      tone(ctx, dest, t, f, vel * 0.6, 2.1, 0.003, -3);
      tone(ctx, dest, t, f, vel * 0.6, 1.9, 0.003, 3);
      tone(ctx, dest, t, f * 2, vel * 0.12, 0.9, 0.002);
      tone(ctx, dest, t, f * 3, vel * 0.07, 0.45, 0.0015);
      tone(ctx, dest, t, f * 4.16, vel * 0.05, 0.2, 0.0012);
      return;
    }
    case 'musicbox': {
      tone(ctx, dest, t, f, vel, 2.0, 0.0018);
      tone(ctx, dest, t, f * 3, vel * 0.18, 0.5, 0.0012);
      tone(ctx, dest, t, f * 6.2, vel * 0.05, 0.12, 0.001);
      return;
    }
    case 'epiano': {
      const end = t + dur + 1.3;
      const body = ctx.createGain();
      body.gain.setValueAtTime(0, t);
      body.gain.linearRampToValueAtTime(vel, t + 0.006);
      body.gain.exponentialRampToValueAtTime(vel * 0.42, t + 0.55);
      body.gain.setTargetAtTime(vel * 0.22, t + 0.55, 0.8);
      body.gain.setValueAtTime(vel * 0.22, t + Math.max(0.6, dur));
      body.gain.exponentialRampToValueAtTime(vel * 0.001, end);
      body.connect(dest);
      const carrier = osc(ctx, body, t, end, f);
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(f * 0.95 * vel, t);
      depth.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.7);
      depth.connect(carrier.frequency);
      osc(ctx, depth, t, end, f);
      tone(ctx, dest, t, f * 4, vel * vel * 0.05, 0.3, 0.002);
      return;
    }
    case 'pluck': {
      const end = t + 1.3;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.5;
      lp.frequency.setValueAtTime(Math.min(f * 6, 8000), t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.3, 300), t + 0.35);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.003);
      g.gain.exponentialRampToValueAtTime(vel * 0.001, end);
      lp.connect(g);
      g.connect(dest);
      osc(ctx, lp, t, end, f, 'triangle', -4);
      osc(ctx, lp, t, end, f, 'triangle', 4);
      return;
    }
    case 'pad': {
      const g = held(ctx, dest, t, dur, vel, Math.min(0.5, dur * 0.4), 0.9);
      const end = t + Math.max(0.5, dur) + 1;
      osc(ctx, g, t, end, f, 'triangle', -4);
      osc(ctx, g, t, end, f, 'triangle', 5);
      return;
    }
    case 'bass': {
      const g = held(ctx, dest, t, dur, vel, 0.012, 0.09);
      const end = t + dur + 0.14;
      osc(ctx, g, t, end, f);
      const upper = ctx.createGain();
      upper.gain.value = 0.3;
      upper.connect(g);
      osc(ctx, upper, t, end, f * 2);
      return;
    }
    case 'pizz': {
      tone(ctx, dest, t, f, vel, 0.8, 0.004);
      tone(ctx, dest, t, f * 2, vel * 0.42, 0.5, 0.003);
      tone(ctx, dest, t, f * 3, vel * 0.16, 0.26, 0.002);
      return;
    }
    case 'flute': {
      const g = held(ctx, dest, t, dur, vel, 0.07, 0.16);
      const end = t + dur + 0.2;
      const main = osc(ctx, g, t, end, f);
      const breath = ctx.createGain();
      breath.gain.value = 0.11;
      breath.connect(g);
      osc(ctx, breath, t, end, f * 2);
      const wobble = ctx.createGain();
      wobble.gain.setValueAtTime(0, t);
      wobble.gain.setValueAtTime(0, t + 0.2);
      wobble.gain.linearRampToValueAtTime(f * 0.004, t + 0.5);
      wobble.connect(main.frequency);
      osc(ctx, wobble, t, end, 5.1);
      return;
    }
    case 'wood': {
      tone(ctx, dest, t, f, vel, 0.05, 0.001);
      tone(ctx, dest, t, f * 1.72, vel * 0.3, 0.03, 0.001);
      return;
    }
    case 'conga': {
      sweep(ctx, dest, t, f * 1.5, f, 0.03, vel, 0.24, 0.002);
      return;
    }
    case 'shaker': {
      puff(ctx, dest, t, 'highpass', 5200, 6000, 0.6, vel, 0.05, 0.006);
      return;
    }
    case 'drop': {
      sweep(ctx, dest, t, f * 0.62, f * 1.35, 0.05, vel, 0.11, 0.003);
      return;
    }
  }
}
