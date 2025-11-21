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
        
        // In build, return placeholder - we'll replace with bundled coordinator in generateBundle
        return `export default "__COORDINATOR_HTML_PLACEHOLDER__";`;
      }
    },

    generateBundle(options, bundle) {
      // Find the bundled coordinator.js
      const coordinatorChunk = Object.entries(bundle).find(([name, chunk]) =>
        chunk.type === 'chunk' && name.includes('coordinator') && !name.includes('main')
      );

      if (coordinatorChunk) {
        const [coordFileName, coordChunk] = coordinatorChunk;
        const coordinatorCode = coordChunk.code;
        
        console.log('[coordinator-inline] Found coordinator chunk:', coordFileName);
        
        // Create HTML with inlined coordinator code
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

        // Replace placeholder in main bundle
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (chunk.type === 'chunk' && fileName.startsWith('assets/main-')) {
            if (chunk.code.includes('__COORDINATOR_HTML_PLACEHOLDER__')) {
              chunk.code = chunk.code.replace(
                '"__COORDINATOR_HTML_PLACEHOLDER__"',
                JSON.stringify(coordinatorHtml)
              );
              console.log('[coordinator-inline] Embedded coordinator HTML into', fileName);
            }
          }
        }
      } else {
        console.warn('[coordinator-inline] Could not find coordinator chunk in bundle');
      }
    }
  };
}
