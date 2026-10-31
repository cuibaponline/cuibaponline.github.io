// The output chain. Shared with tools/audio-check so the limiter is tested as it ships.
//
//   loops → musicIn → muffle → duck → musicBus ─┐
//                                               ├→ master → limiter → output
//   voices, laser ──────────────────→ sfxBus ───┘

export const MUFFLE_OPEN_HZ = 15000;
export const MUFFLE_CLOSED_HZ = 520;

/** Pulls the music under the effects; the buffers are already level-matched to each other. */
export const MUSIC_TRIM = 0.8;
/** Offsets the compressor's automatic make-up gain, leaving margin below full scale. */
const OUTPUT_TRIM = 0.6;

export interface OutputGraph {
  musicIn: GainNode;
  muffle: BiquadFilterNode;
  duck: GainNode;
  musicBus: GainNode;
  sfxBus: GainNode;
  master: GainNode;
  limiter: DynamicsCompressorNode;
  output: GainNode;
}

export const volumeToGain = (v: number): number => {
  const clamped = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
  return clamped ** 1.6;
};

export function buildGraph(ctx: BaseAudioContext, musicVolume: number, sfxVolume: number): OutputGraph {
  const musicIn = ctx.createGain();

  const muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.Q.value = 0.4;
  muffle.frequency.value = MUFFLE_OPEN_HZ;

  const duck = ctx.createGain();

  const musicBus = ctx.createGain();
  musicBus.gain.value = volumeToGain(musicVolume) * MUSIC_TRIM;

  const sfxBus = ctx.createGain();
  sfxBus.gain.value = volumeToGain(sfxVolume);

  const master = ctx.createGain();

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 14;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;

  const output = ctx.createGain();
  output.gain.value = OUTPUT_TRIM;

  musicIn.connect(muffle);
  muffle.connect(duck);
  duck.connect(musicBus);
  musicBus.connect(master);
  sfxBus.connect(master);
  master.connect(limiter);
  limiter.connect(output);
  output.connect(ctx.destination);

  return { musicIn, muffle, duck, musicBus, sfxBus, master, limiter, output };
}
