import * as Comlink from 'comlink';

class GenerateHtml extends HTMLElement {
  static get observedAttributes() {
    return ['prompt', 'api-key', 'model', 'provider', 'type', 'sizing'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._coordinator = null;
    this._iframe = null;
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
      <iframe id="coordinator-frame" sandbox="allow-scripts allow-same-origin"></iframe>
    `;
    this._iframe = this.shadowRoot.getElementById('coordinator-frame');
  }

  async _initCoordinator() {
    if (!this._iframe) return;

    // Point to the HTML file which is a build entry point and gets properly transformed.
    // In dev: Vite serves /src/coordinator.html directly
    // In prod: The built file is at /src/coordinator.html in the dist folder
    this._iframe.src = '/src/coordinator.html';
    
    // Wait for iframe load
    this._iframe.onload = () => {
      console.log('[GenerateHtml] Coordinator iframe loaded');
      // Initialize Comlink
      this._coordinator = Comlink.wrap(Comlink.windowEndpoint(this._iframe.contentWindow));
      
      // If we already have a prompt, generate immediately
      if (this.getAttribute('prompt')) {
        this.triggerGeneration();
      }
    };
  }

  async triggerGeneration() {
    if (!this._coordinator) return;

    console.log('[GenerateHtml] Triggering generation...');
    const config = {
      prompt: this.getAttribute('prompt'),
      apiKey: this.getAttribute('api-key'),
      model: this.getAttribute('model'),
      provider: this.getAttribute('provider') || 'gemini',
      type: this.getAttribute('type') || 'html'
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
