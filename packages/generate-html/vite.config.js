import { defineConfig } from 'vite';
import coordinatorInlinePlugin from './plugin.js';

export default defineConfig({
  plugins: [coordinatorInlinePlugin()],
  build: {
    lib: {
      entry: 'src/generate-html.js',
      formats: ['es']
    },
    rollupOptions: {
      // Ensure external dependencies are not bundled
      //external: ['comlink', '@google/genai'],
      output: {
        globals: {
          comlink: 'Comlink',
          '@google/genai': 'GoogleGenAI'
        }
      }
    }
  }
});
