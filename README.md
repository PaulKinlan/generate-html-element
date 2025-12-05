# `<generate-html>` Web Component

A secure, LLM-powered Web Component that generates and renders interactive HTML or SVG images on the fly using Google Gemini or Chrome's built-in AI.

## Features

*   **✨ AI-Generated Content:** Turns text prompts into interactive web apps (calculators, games) or SVG images.
*   **🔒 Secure Sandbox:** Uses a "Double Iframe" architecture to ensure generated code cannot access your API keys or host page data.
*   **🚀 Multi-Provider:** Supports **Google Gemini** (via API Key) and **Chrome Built-in AI** (experimental `window.LargeLanguageModel`).
*   **⚡ Vanilla JS:** Zero framework dependencies. Built with standard Web Components.

## Installation

Since this is a prototype/demo structure using Vite:

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the Demo:**
    ```bash
    npm run dev
    ```
    Open the link (usually `http://localhost:5173`) to see the demo.

## Installation (Package)

You can also install the component directly via npm:

```bash
npm install @paulkinlan/generate-html
```

## Usage

Import the component script (bundled) and use the tag in your HTML.

```html
<script type="module" src="/src/generate-html.js"></script>

<generate-html
  prompt="Create a snake game"
  api-key="YOUR_GEMINI_API_KEY"
  model="gemini-2.5-flash-latest"
  provider="gemini"
  type="html"
></generate-html>
```

### Attributes

| Attribute  | Description                                      | Default |
| :--- | :--- | :--- |
| `prompt`   | The text description of what to generate.        | (Required) |
| `api-key`  | Your Google Gemini API Key.                      | (Required for Gemini) |
| `provider` | `gemini` or `chrome-ai`.                         | `gemini` |
| `model`    | Model version (e.g., `gemini-2.5-flash-latest`). | `gemini-2.5-flash-latest` |
| `type`     | Output type: `html` (interactive) or `image` (SVG). | `html` |
| `sizing`   | `content` (auto-resize to content) or `fill` (100% height). | `fill` |
| `csp`      | Custom Content Security Policy. If not set, a secure default policy is used. | (Auto-generated) |
| `debug`    | Boolean. If present, logs debug info to console. | `false` |

## Security Architecture

This component handles untrusted AI-generated code. To prevent XSS and data leakage, it employs a **Double Iframe Strategy** with **Content Security Policy (CSP)**:

1.  **Host Page (`<generate-html>`)**:
    *   Living in your application.
    *   Has access to the API Key.
    *   **Does NOT** render the generated content directly.

2.  **Coordinator Iframe (Hidden)**:
    *   **Source:** Inlined/Bundled (no separate network request).
    *   Communicates with the Host via `Comlink`.
    *   Handles the API calls to Gemini/Chrome AI.
    *   Creates the *Renderer Iframe*.
    *   **CSP Applied:** Automatically configured based on provider.

3.  **Renderer Iframe (Sandboxed)**:
    *   Loaded via a `Blob` URL.
    *   **Sandbox Attributes:** `allow-scripts allow-forms`.
    *   **Crucially Missing:** `allow-same-origin`. This treats the origin as opaque/null.
    *   The generated HTML/JS runs here. It cannot access the Coordinator's variables (API Key) or the Host's LocalStorage/Cookies.
    *   **CSP Applied:** Same policy as Coordinator to restrict external resources.

### Content Security Policy

By default, the component applies a strict CSP to both iframes:

*   **Default Policy:** `default-src 'none'` - All external resources blocked by default
*   **Allowed:** Inline scripts/styles, blob URLs, data URLs
*   **Provider-specific:** 
    *   **Gemini:** Adds `https://generativelanguage.googleapis.com` to `connect-src`
    *   **Chrome AI:** Local only, no external connections

**Implementation:**
*   **Priority:** Uses the iframe `csp` attribute (Chrome/Edge support) for cleaner enforcement
*   **Fallback:** Injects CSP meta tags into HTML for browsers without iframe `csp` attribute support

**Custom CSP:**
```html
<generate-html 
  prompt="Create a game"
  csp="default-src 'self'; script-src 'unsafe-inline'; connect-src https://api.example.com">
</generate-html>
```

## Development

*   **Build:** `npm run build`
*   **Preview:** `npm run preview`

## Project Structure

This is a monorepo containing:

*   `packages/generate-html`: The core web component package.
*   `packages/demo`: A demo application showcasing the component.
*   `src/`: Shared source files.

## Requirements

*   **Gemini Provider:** A valid Google Cloud API Key with access to Gemini models.
*   **Chrome AI Provider:** Requires Chrome Canary/Dev with `window.LanguageModel` API enabled.
