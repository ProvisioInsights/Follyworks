import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/saira-stencil-one/400.css';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/vt323/400.css';
import './ui/styles.css';
import './ui/modern.css';
import './ui/arcade.css';
import './ui/touch.css';
import './components';
import { App } from './app/App';

const boot = async () => {
  // make sure web fonts are ready before canvas text (labels) is drawn
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* ignore */
  }
  const app = new App();
  await app.start();
};

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('boot');
  if (el) el.textContent = `Follyworks failed to start: ${(err as Error).message}`;
});
