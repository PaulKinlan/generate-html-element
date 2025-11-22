import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Vite plugin to bundle coordinator.js and embed it inline in HTML template
 */
export default function coordinatorInlinePlugin() {
  let config;
  const VIRTUAL_ID = 'virtual:coordinator-html';
  const RESOLVED_ID = '\0' + VIRTUAL_ID;

  return {
    name: 'coordinator-inline',
    
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) {
        return RESOLVED_ID;
      }
    },

    load(id) {
      if (id === RESOLVED_ID) {
        // In dev, return the source HTML (Vite dev server will serve coordinator.js)
        if (config.command === 'serve') {
          const htmlPath = resolve(config.root, 'src/coordinator.html');
          const html = readFileSync(htmlPath, 'utf-8');
          return `export default ${JSON.stringify(html)}`;
        }
        
        // In build, read the pre-built coordinator bundle
        try {
          const coordinatorPath = resolve(config.root, 'dist/coordinator.js');
          const coordinatorCode = readFileSync(coordinatorPath, 'utf-8');
          
          console.log('[coordinator-inline] Found pre-built coordinator:', coordinatorPath);
          
          const coordinatorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Coordinator</title>
  <style>
    html, body {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <script type="module">
${coordinatorCode}
  </script>
</body>
</html>`;
          return `export default ${JSON.stringify(coordinatorHtml)}`;
        } catch (e) {
          console.error('[coordinator-inline] Failed to read pre-built coordinator:', e);
          throw e;
        }
      }
    }
  };
}
