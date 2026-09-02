// js/resume-banner.js
//
// Home page only. If this device recently hosted or joined a game (tracked
// via ui.js's rememberActiveGame), offers a way back in — otherwise a
// player who navigates away mid-game (e.g. the browser back button) has no
// indication they were ever playing.
import { getGame } from './firebase.js';
import { getActiveGame, forgetActiveGame } from './ui.js';
import { describeResumableGame } from './game-logic.js';

const code = getActiveGame();

if (code) {
  getGame(code)
    .then(game => {
      const info = describeResumableGame(code, game);
      if (!info) {
        forgetActiveGame(); // game no longer exists — stop offering it
        return;
      }

      const el = document.getElementById('resume-banner');
      if (!el) return;

      document.getElementById('resume-banner-text').textContent = info.text;
      const link = document.getElementById('resume-banner-link');
      link.textContent = info.linkText;
      link.href = info.href;

      document.getElementById('resume-banner-dismiss').addEventListener('click', () => {
        forgetActiveGame();
        el.style.display = 'none';
      });

      el.style.display = 'flex';
    })
    .catch(() => {}); // offline/error — fail silent, no banner
}
