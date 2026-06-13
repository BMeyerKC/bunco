// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  build: {
    format: 'file',  // game.astro → dist/game.html (preserves existing URLs)
  },
  trailingSlash: 'never',
});
