import { bootStep, lastSteps } from './services/bootLog';
import '@fontsource-variable/fredoka/wght.css';
import './ui/styles.css';
import { App } from './ui/app';

const app = new App();
app.boot().catch((err: unknown) => {
  console.error(err);
  const detail = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err);
  bootStep(`BOOT FAILED ${detail}`);
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.textContent = 'Something went wrong. Please close the game and open it again.';
  const pre = document.createElement('pre');
  pre.style.cssText = 'max-width:92vw;margin-top:16px;font:13px/1.35 monospace;white-space:pre-wrap;word-break:break-word;text-align:left';
  pre.textContent = `${lastSteps(3).join('\n')}\n${detail}`.slice(0, 1400);
  boot.append(pre);
});
