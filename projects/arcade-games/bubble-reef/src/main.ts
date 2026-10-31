import { bootStep, showFailure } from './services/bootLog';
import '@fontsource-variable/fredoka/wght.css';
import './ui/styles.css';

/** Imported here rather than at the top so a config that fails to parse reaches the failure screen below. */
async function start(): Promise<void> {
  const { App } = await import('./ui/app');
  await new App().boot();
}

start().catch((err: unknown) => {
  console.error(err);
  const detail = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err);
  bootStep(`BOOT FAILED ${detail}`);
  showFailure(detail);
});
