import { bootStep, showFailure } from './services/bootLog';
import '@fontsource-variable/fredoka/wght.css';
import './ui/styles.css';
import { App } from './ui/app';

const app = new App();
app.boot().catch((err: unknown) => {
  console.error(err);
  const detail = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err);
  bootStep(`BOOT FAILED ${detail}`);
  showFailure(detail);
});
