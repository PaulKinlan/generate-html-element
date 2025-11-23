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

  async _initCoordinator() {
    if (!this._iframe) return;

    // Build CSP based on provider and custom attribute
    const csp = this._buildCSP();
    
    // Inject CSP meta tag into coordinator HTML
    let modifiedHtml = coordinatorHtml;
    const cspMetaTag = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
    
    // Insert CSP meta tag into head
    if (modifiedHtml.includes('</head>')) {
      modifiedHtml = modifiedHtml.replace('</head>', `${cspMetaTag}\n  </head>`);
    } else if (modifiedHtml.includes('<head>')) {
      modifiedHtml = modifiedHtml.replace('<head>', `<head>\n  ${cspMetaTag}`);
    } else {
      // If no head tag, prepend at start of HTML
      modifiedHtml = cspMetaTag + '\n' + modifiedHtml;
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
      csp: this._buildCSP() // Pass CSP to coordinator for renderer iframe
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
