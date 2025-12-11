import * as Comlink from 'comlink';
import { GoogleGenAI } from '@google/genai';

class Coordinator {
  constructor() {
    this.renderContainer = null;
    this._resizeHandler = null;
  }

  async generateContent(config) {
    console.log('[Coordinator] generateContent called with config:', { ...config, apiKey: '***', csp: config.csp ? '***' : undefined });
    const { prompt, apiKey, model, provider, type, csp } = config;

    if (!prompt) return;

    if (this.renderContainer) {
      this.renderContainer.remove();
      this.renderContainer = null;
    }
    
    // Cleanup previous listener if it exists
    if (this._resizeHandler) {
      window.removeEventListener('message', this._resizeHandler);
      this._resizeHandler = null;
    }

    let content = '';

    try {
      if (provider === 'chrome-ai') {
        console.log('[Coordinator] Using Chrome AI provider');
        content = await this._generateChromeAI(prompt, model, type);
      } else {
        console.log('[Coordinator] Using Gemini provider');
        content = await this._generateGemini(prompt, apiKey, model, type);
      }
    } catch (error) {
      console.error('[Coordinator] Generation failed:', error);
      content = `
        <style>
          html, body { margin: 0; padding: 0; height: 100%; }
          body { font-family: system-ui; padding: 20px; color: #d32f2f; background: #ffebee; box-sizing: border-box; }
        </style>
        <h3>Generation Error</h3>
        <p>${error.message}</p>
        <p>Check console for details.</p>
      `;
    }

    console.log('[Coordinator] Rendering content (length: ' + content.length + ')');
    this._render(content, type, csp);
  }

  async _generateGemini(prompt, apiKey, model, type) {
    console.log('[Coordinator] _generateGemini start');
    if (!apiKey) throw new Error('API Key is required for Gemini provider');

    // Correct instantiation for the new @google/genai SDK
    const client = new GoogleGenAI({ apiKey });
    
    let systemInstruction = "You are a helpful assistant.";
    let promptSuffix = "";

    if (type === 'image') {
      systemInstruction = "You are an image generator. You must generate an SVG representation of the requested image. Return ONLY the raw SVG code, starting with <svg and ending with </svg>. Do not wrap in markdown code blocks.";
      promptSuffix = " (Return raw SVG only)";
    } else {
      systemInstruction = "You are a web developer. You must generate a fully functional, interactive HTML document based on the user's request. Include all necessary CSS and JS inside the HTML. Return ONLY the raw HTML code. Do not wrap in markdown code blocks. Start with <!DOCTYPE html>. Do not link to external CSS or JS files (like Google Fonts or CDNs). All styling and scripts must be embedded inline.";
      promptSuffix = " (Return raw HTML only)";
    }

    const responseStream = await client.models.generateContentStream({
      model: model || 'gemini-2.5-flash-latest',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemInstruction }, 
            { text: prompt + promptSuffix }
          ]
        }
      ]
    });

    let text = '';
    for await (const chunk of responseStream) {
      // @google/genai chunks might have .text as a property or require different access
      // Based on user's previous edit for non-streaming, we try property access.
      const chunkText = chunk.text; 
      if (chunkText) {
        text += chunkText;
      }
    }
    
    console.log('[Coordinator] _generateGemini complete');
    return this._cleanMarkdown(text);
  }

  async _generateChromeAI(prompt, model, type) {
    console.log('[Coordinator] _generateChromeAI start');
    if (!window.LanguageModel) {
      throw new Error('Chrome AI (window.LanguageModel) is not supported or enabled in this browser.');
    }

    const availability  = await LanguageModel.availability();

     if (availability === 'unavailable') {
      throw new Error('Chrome AI (window.LanguageModel) is not supported or enabled in this browser.');
    }  
    
    const systemPrompt = type === 'image' 
      ? 'Generate an SVG image. Return only raw SVG code.' 
      : 'Generate a self-contained HTML page with CSS/JS. Return only raw HTML code. Do not link to external CSS or JS files. All styling and scripts must be embedded inline.';

    const session = await LanguageModel.create({
      initialPrompts: [{
        role: 'system',
        content: systemPrompt
      }]
    });

    const stream = await session.promptStreaming(prompt);
    let result = '';
    for await (const chunk of stream) {
      result = chunk;
    }
    console.log('[Coordinator] _generateChromeAI complete');
    return this._cleanMarkdown(result);
  }

  _cleanMarkdown(text) {
    if (!text) return '';
    // Remove ```html ... ``` or ```svg ... ``` wrapper if present
    return text.replace(/^```(html|svg|xml)?\n/, '').replace(/\n```$/, '');
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _render(content, type, csp) {
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.display = 'block';
    iframe.sandbox = 'allow-scripts allow-forms'; 
    
    // Ensure content type is correct
    let finalContent = content;
    if (type === 'image' && !content.trim().startsWith('<svg')) {
        // If it's supposed to be an image but isn't SVG, wrap it or handle error?
        // For now, we assume LLM returns SVG.
    }

    // Apply CSP if provided - try iframe csp attribute first, fallback to meta tag
    if (csp) {
      // Try setting the csp attribute for feature detection
      iframe.setAttribute('csp', csp);
      const supportsCspAttribute = iframe.getAttribute('csp') === csp;
      
      if (supportsCspAttribute) {
        // Modern approach: use iframe csp attribute (must be set before src)
        console.log('[Coordinator] Using iframe csp attribute for renderer');
        // Keep the attribute set, will be used when src is set
      } else {
        // Fallback: inject CSP meta tag into content if csp attribute not supported
        console.log('[Coordinator] Falling back to CSP meta tag injection for renderer');
        // Remove the attribute if not supported
        iframe.removeAttribute('csp');
        
        const escapedCsp = this._escapeHtml(csp);
        const cspMetaTag = `<meta http-equiv="Content-Security-Policy" content="${escapedCsp}">`;
        
        // Use robust pattern matching to inject into head
        const headMatch = finalContent.match(/<head[^>]*>/i);
        if (headMatch) {
          const headTagEnd = headMatch.index + headMatch[0].length;
          finalContent = finalContent.substring(0, headTagEnd) + '\n' + cspMetaTag + finalContent.substring(headTagEnd);
        } else {
          // Try to find html tag
          const htmlMatch = finalContent.match(/<html[^>]*>/i);
          if (htmlMatch) {
            const htmlTagEnd = htmlMatch.index + htmlMatch[0].length;
            finalContent = finalContent.substring(0, htmlTagEnd) + '\n' + cspMetaTag + '\n' + finalContent.substring(htmlTagEnd);
          } else {
            // Last resort: prepend at start
            finalContent = cspMetaTag + '\n' + finalContent;
          }
        }
      }
    }

    // Inject resizing script for HTML content
    if (type !== 'image') {
      // Ensure default styles for full height and no margin if not likely present
      // We prepend this to ensure it's available but can be overridden by user CSS if specific
      const defaultStyles = `<style>html, body { margin: 0; padding: 0; height: 100%; }</style>`;
      if (!finalContent.includes('<style>')) {
         // Simple heuristic: if no style tag, add ours. 
         // Ideally we'd parse, but prepending to body or head is safer.
         if (finalContent.includes('<head>')) {
            finalContent = finalContent.replace('<head>', '<head>' + defaultStyles);
         } else {
            finalContent = defaultStyles + finalContent;
         }
      }

      const resizeScript = `
        <script>
          (function() {
            console.log('[InjectedScript] Script started');
            
            const sendResize = () => {
              const height = document.documentElement.scrollHeight;
              console.log('[InjectedScript] Sending resize:', height);
              window.parent.postMessage({ type: 'generated-content-resize', height }, '*');
            };

            window.addEventListener('load', () => {
                console.log('[InjectedScript] Window loaded');
                sendResize();
            });

            const observer = new ResizeObserver(() => {
              console.log('[InjectedScript] ResizeObserver triggered');
              sendResize();
            });
            observer.observe(document.body);
            
            // Initial check
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                 console.log('[InjectedScript] Document ready, sending initial resize');
                 sendResize();
            }
          })();
        </script>
      `;
      // Append script before closing body tag or at the end
      if (finalContent.includes('</body>')) {
        finalContent = finalContent.replace('</body>', resizeScript + '</body>');
      } else {
        finalContent += resizeScript;
      }
    }

    const blob = new Blob([finalContent], { type: 'text/html' });
    iframe.src = URL.createObjectURL(blob);

    document.body.appendChild(iframe);
    this.renderContainer = iframe;

    // Listen for messages from the nested iframe and forward them up
    this._resizeHandler = (event) => {
      if (event.data && event.data.type === 'generated-content-resize') {
        // Forward to the top-level parent (the application hosting the coordinator)
        console.log('[Coordinator] Forwarding resize:', event.data.height);
        window.parent.postMessage(event.data, '*');
      }
    };
    window.addEventListener('message', this._resizeHandler);
  }
}

Comlink.expose(new Coordinator());
