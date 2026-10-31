import '@fontsource-variable/fredoka/wght.css';
import './ui/styles.css';
import { App } from './ui/app';

const app = new App();
app.boot().catch((err: unknown) => {
  console.error(err);
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = 'Something went wrong. Please close the game and open it again.';
});
