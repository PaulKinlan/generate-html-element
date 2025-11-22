import * as Comlink from 'comlink';
import { GoogleGenAI } from '@google/genai';

class Coordinator {
  constructor() {
    this.renderContainer = null;
    this._resizeHandler = null;
    this.debug = false;
  }

  log(...args) {
    if (this.debug) {
      console.log(...args);
    }
  }

  async generateContent(config) {
    this.debug = !!config.debug;
    this.log('[Coordinator] generateContent called with config:', { ...config, apiKey: '***' });
    const { prompt, apiKey, model, provider, type } = config;

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
        this.log('[Coordinator] Using Chrome AI provider');
        content = await this._generateChromeAI(prompt, model, type);
      } else {
        this.log('[Coordinator] Using Gemini provider');
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

    this.log('[Coordinator] Rendering content (length: ' + content.length + ')');
    this._render(content, type);
  }

  async _generateGemini(prompt, apiKey, model, type) {
    this.log('[Coordinator] _generateGemini start');
    if (!apiKey) throw new Error('API Key is required for Gemini provider');

    const client = new GoogleGenAI({ apiKey });
    
    let systemInstruction = "You are a helpful assistant.";
    let promptSuffix = "";

    if (type === 'image') {
      systemInstruction = "You are an image generator. Generate an SVG image. Return the raw SVG code wrapped in a markdown code block (```svg ... ```). Do not explain the output.";
      promptSuffix = " (Return SVG in markdown code block)";
    } else {
      systemInstruction = "You are a web developer. Generate a self-contained HTML page with CSS/JS. Return the raw HTML code wrapped in a markdown code block (```html ... ```). Do not explain the output. Start with <!DOCTYPE html>. Do not link to external CSS or JS files. All styling and scripts must be embedded inline.";
      promptSuffix = " (Return HTML in markdown code block)";
    }

    this.log('[Coordinator] Gemini System Instruction:', systemInstruction);
    this.log('[Coordinator] Gemini User Prompt:', prompt + promptSuffix);

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

    const parser = new CodeBlockParser();
    for await (const chunk of responseStream) {
      const chunkText = chunk.text; 
      if (chunkText) {
        if (!parser.feed(chunkText)) {
          this.log('[Coordinator] Gemini: Code block closed, stopping stream.');
          break;
        }
      }
    }
    
    const finalCode = parser.getCode();
    this.log('[Coordinator] Gemini Final Code Length:', finalCode.length);
    this.log('[Coordinator] _generateGemini complete');
    return finalCode;
  }

  async _generateChromeAI(prompt, model, type) {
    this.log('[Coordinator] _generateChromeAI start');
    if (!window.LanguageModel) {
      throw new Error('Chrome AI (window.LanguageModel) is not supported or enabled in this browser.');
    }

    const availability  = await LanguageModel.availability();

     if (availability == "no") {
      throw new Error('Chrome AI (window.LanguageModel) is not supported or enabled in this browser.');
    }  
    
    const systemPrompt = type === 'image' 
      ? 'Generate an SVG image. Return the raw SVG code wrapped in a markdown code block (```svg ... ```). Do not explain the output.' 
      : 'Generate a self-contained HTML page with CSS/JS. Return the raw HTML code wrapped in a markdown code block (```html ... ```). Do not explain the output. Do not link to external CSS or JS files. All styling and scripts must be embedded inline.';

    this.log('[Coordinator] Chrome AI System Prompt:', systemPrompt);
    this.log('[Coordinator] Chrome AI User Prompt:', prompt);

    const session = await LanguageModel.create({
      initialPrompts: [{
        role: 'system',
        content: systemPrompt
      }],
      expectedInputs: [{type: 'text'}]
    });

    const stream = await session.promptStreaming(prompt);
    const parser = new CodeBlockParser();
    
    for await (const chunk of stream) {
      this.log('[Coordinator] Chrome AI Chunk:', chunk);
      if (!parser.feed(chunk)) {
        this.log('[Coordinator] Chrome AI: Code block closed, stopping stream.');
        break;
      }
    }
    
    const finalCode = parser.getCode();
    this.log('[Coordinator] Chrome AI Final Code Length:', finalCode.length);
    this.log('[Coordinator] _generateChromeAI complete');
    return finalCode;
  }

  _cleanMarkdown(text) {
    // Deprecated, logic moved to CodeBlockParser
    return text;
  }

  _render(content, type) {
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.display = 'block';
    iframe.sandbox = 'allow-scripts allow-forms'; 
    
    // Ensure content type is correct
    let finalContent = content;
    console.log('[Coordinator] _render content:', content);
    if (type === 'image' && !content.trim().startsWith('<svg')) {
        // If it's supposed to be an image but isn't SVG, wrap it or handle error?
        // For now, we assume LLM returns SVG.
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
        this.log('[Coordinator] Forwarding resize:', event.data.height);
        window.parent.postMessage(event.data, '*');
      }
    };
    window.addEventListener('message', this._resizeHandler);
  }
}

class CodeBlockParser {
  constructor() {
    this.buffer = '';
    this.state = 'WAITING'; // WAITING, IN_BLOCK, FINISHED
    this.capturedCode = '';
  }

  /**
   * Processes a chunk of text.
   * @param {string} chunk - The new text chunk.
   * @returns {boolean} - True if processing should continue, False if block is finished.
   */
  feed(chunk) {
    if (this.state === 'FINISHED') return false;

    this.buffer += chunk;

    if (this.state === 'WAITING') {
      // Look for start of code block
      const startMatch = this.buffer.match(/```(?:html|svg|xml)?\s*/i);
      if (startMatch) {
        this.state = 'IN_BLOCK';
        // Remove the start tag from buffer and move rest to capturedCode
        this.capturedCode = this.buffer.substring(startMatch.index + startMatch[0].length);
        this.buffer = ''; // Buffer is now used for checking end tag split? No, just append to capturedCode
      }
    } else if (this.state === 'IN_BLOCK') {
      this.capturedCode += chunk;
    }

    if (this.state === 'IN_BLOCK') {
      // Check for end of code block
      const endMatch = this.capturedCode.indexOf('```');
      if (endMatch !== -1) {
        this.capturedCode = this.capturedCode.substring(0, endMatch);
        this.state = 'FINISHED';
        return false; // Stop processing
      }
    }

    return true; // Continue processing
  }

  getCode() {
    return this.capturedCode;
  }
}

Comlink.expose(new Coordinator());
