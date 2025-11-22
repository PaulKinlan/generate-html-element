import { defineConfig } from 'vite';
import coordinatorInlinePlugin from './plugin.js';

export default defineConfig({
  plugins: [coordinatorInlinePlugin()],
  build: {
    lib: {
      entry: {
        'generate-html': 'src/generate-html.js',
        'coordinator': 'src/coordinator.js'
      },
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
