// Thin wrappers over OfflineAudioContext so a stalled render can't wedge the service.

type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

const RENDER_TIMEOUT_MS = 30_000;

export function offlineContext(channels: number, frames: number, sampleRate: number): OfflineAudioContext {
  const w = globalThis as unknown as { OfflineAudioContext?: OfflineCtor; webkitOfflineAudioContext?: OfflineCtor };
  const Ctor = w.OfflineAudioContext ?? w.webkitOfflineAudioContext;
  if (!Ctor) throw new Error('OfflineAudioContext unavailable');
  return new Ctor(channels, frames, sampleRate);
}

export function renderOffline(ctx: OfflineAudioContext): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('offline render timed out')), RENDER_TIMEOUT_MS);
    const done = (buffer: AudioBuffer) => {
      clearTimeout(timer);
      resolve(buffer);
    };
    ctx.oncomplete = (event) => done(event.renderedBuffer);
    // Old WebKit's startRendering returns undefined and only fires oncomplete.
    const started = ctx.startRendering() as Promise<AudioBuffer> | undefined;
    started?.then(done, (err: unknown) => {
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/** Hands the main thread back between chunks of work. */
export const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
