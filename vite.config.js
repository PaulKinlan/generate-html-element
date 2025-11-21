import { defineConfig } from 'vite';
import coordinatorInlinePlugin from './vite-plugin-coordinator-inline.js';

export default defineConfig({
  plugins: [coordinatorInlinePlugin()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html'
      },
      output: {
        manualChunks(id) {
          // Force coordinator.js into its own chunk
          if (id.includes('coordinator.js')) {
            return 'coordinator';
          }
        }
      }
    }
  }
});
