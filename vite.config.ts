import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Сборка в один самодостаточный index.html (модели встроены внутрь) — так требуют рекламные сети.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 5000,
  },
});
