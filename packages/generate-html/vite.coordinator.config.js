import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    emptyOutDir: false, // Don't clear dist, as we might be running this before/after main build
    lib: {
      entry: resolve(__dirname, 'src/coordinator.js'),
      name: 'Coordinator',
      fileName: 'coordinator',
      formats: ['es']
    },
    rollupOptions: {
      output: {
        // Force single file, no code splitting
        inlineDynamicImports: true,
        manualChunks: undefined
      }
    }
  }
});
