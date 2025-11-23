import * as Comlink from 'comlink';
// Side-effect import to ensure coordinator.js gets bundled
import './coordinator.js';
// Import coordinator HTML as bundled string from virtual module (build-time embedding)
import coordinatorHtml from 'virtual:coordinator-html';

class GenerateHtml extends HTMLElement {
  static get observedAttributes() {
    return ['prompt', 'api-key', 'model', 'provider', 'type', 'sizing', 'csp'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._coordinator = null;
    this._iframe = null;
    this._currentCsp = null;
  }

  connectedCallback() {
    this.render();
    this._initCoordinator();
    window.addEventListener('message', this._handleResize.bind(this));
  }

  disconnectedCallback() {
    window.removeEventListener('message', this._handleResize.bind(this));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      console.log(`[GenerateHtml] Attribute changed: ${name} from '${oldValue}' to '${newValue}'`);
      // If prompt changes, trigger generation
      if (name === 'prompt' && newValue) {
        this.triggerGeneration();
      }
      if (name === 'sizing') {
        this._updateSizing();
      }
      if (name === 'csp' || name === 'provider') {
        // CSP or provider change requires re-initialization of coordinator
        this._initCoordinator();
      }
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          border: 1px solid #ccc;
          position: relative;
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
        }
      </style>
      <iframe 
        id="coordinator-frame" 
        sandbox="allow-scripts"
        allow="language-model">
      </iframe>
    `;
    this._iframe = this.shadowRoot.getElementById('coordinator-frame');
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async _initCoordinator() {
    if (!this._iframe) return;

    // Build CSP based on provider and custom attribute
    const csp = this._buildCSP();
    
    // Inject CSP meta tag into coordinator HTML
    let modifiedHtml = coordinatorHtml;
    const escapedCsp = this._escapeHtml(csp);
    const cspMetaTag = `<meta http-equiv="Content-Security-Policy" content="${escapedCsp}">`;
    
    // Insert CSP meta tag into head - use more robust pattern matching
    const headMatch = modifiedHtml.match(/<head[^>]*>/i);
    if (headMatch) {
      const headTagEnd = headMatch.index + headMatch[0].length;
      modifiedHtml = modifiedHtml.substring(0, headTagEnd) + '\n  ' + cspMetaTag + modifiedHtml.substring(headTagEnd);
    } else {
      // If no head tag found, prepend to content after doctype/html
      const htmlMatch = modifiedHtml.match(/<html[^>]*>/i);
      if (htmlMatch) {
        const htmlTagEnd = htmlMatch.index + htmlMatch[0].length;
        modifiedHtml = modifiedHtml.substring(0, htmlTagEnd) + '\n' + cspMetaTag + '\n' + modifiedHtml.substring(htmlTagEnd);
      } else {
        // Last resort: prepend at start
        modifiedHtml = cspMetaTag + '\n' + modifiedHtml;
      }
    }

    // Create blob URL from the modified coordinator HTML
    const blob = new Blob([modifiedHtml], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    this._iframe.src = blobUrl;
    
    // Wait for iframe load
    this._iframe.onload = () => {
      console.log('[GenerateHtml] Coordinator iframe loaded from embedded blob URL with CSP');
      // Initialize Comlink
      this._coordinator = Comlink.wrap(Comlink.windowEndpoint(this._iframe.contentWindow));
      
      // If we already have a prompt, generate immediately
      if (this.getAttribute('prompt')) {
        this.triggerGeneration();
      }
    };
  }

  _buildCSP() {
    const provider = this.getAttribute('provider') || 'gemini';
    const customCsp = this.getAttribute('csp');
    
    // If custom CSP is provided, use it
    if (customCsp) {
      console.log('[GenerateHtml] Using custom CSP:', customCsp);
      return customCsp;
    }
    
    // Default CSP: Lock down everything by default
    // Note: 'unsafe-inline' and 'unsafe-eval' are necessary here because:
    // 1. The AI generates inline scripts/styles which cannot be predicted for nonce/hash
    // 2. The content runs in a sandboxed iframe without 'allow-same-origin', 
    //    preventing access to parent context, localStorage, or cookies
    // 3. This is the security tradeoff for allowing dynamic AI-generated interactive content
    let csp = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; frame-src blob:;";
    
    // Add provider-specific origins
    if (provider === 'gemini') {
      csp += " connect-src https://generativelanguage.googleapis.com;";
    } else if (provider === 'chrome-ai') {
      // Chrome AI is local, no external connections needed
      csp += " connect-src 'none';";
    }
    
    console.log('[GenerateHtml] Built CSP for provider', provider, ':', csp);
    this._currentCsp = csp;
    return csp;
  }

  async triggerGeneration() {
    if (!this._coordinator) return;

    console.log('[GenerateHtml] Triggering generation...');
    const config = {
      prompt: this.getAttribute('prompt'),
      apiKey: this.getAttribute('api-key'),
      model: this.getAttribute('model'),
      provider: this.getAttribute('provider') || 'gemini',
      type: this.getAttribute('type') || 'html',
      csp: this._currentCsp || this._buildCSP() // Reuse cached CSP or build if needed
    };

    // Call the coordinator
    try {
      await this._coordinator.generateContent(config);
    } catch (e) {
      console.error('Error communicating with coordinator:', e);
    }
  }
  
  // Public API to force regeneration
  generate() {
    this.triggerGeneration();
  }
  _handleResize(event) {
    // Verify origin if possible, or check source window
    // Since the coordinator is in a sandboxed iframe, the source might be null or restricted.
    // We rely on the message structure.
    
    if (event.data && event.data.type === 'generated-content-resize') {
      console.log('[GenerateHtml] Received resize:', event.data.height);
      this._currentContentHeight = event.data.height;
      this._updateSizing();
    }
  }

  _updateSizing() {
    const sizing = this.getAttribute('sizing');
    console.log(`[GenerateHtml] Updating sizing. Mode: ${sizing}, Height: ${this._currentContentHeight}`);
    if (sizing === 'content' && this._currentContentHeight) {
      this.style.height = `${this._currentContentHeight}px`;
      // Also update the internal iframe container if needed, but :host style should suffice
    } else {
      // Reset to default or CSS defined
      this.style.height = ''; 
    }
  }
}

customElements.define('generate-html', GenerateHtml);
