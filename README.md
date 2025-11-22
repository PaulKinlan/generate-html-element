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

## Security Architecture

This component handles untrusted AI-generated code. To prevent XSS and data leakage, it employs a **Double Iframe Strategy**:

1.  **Host Page (`<generate-html>`)**:
    *   Living in your application.
    *   Has access to the API Key.
    *   **Does NOT** render the generated content directly.

2.  **Coordinator Iframe (Hidden)**:
    *   Loaded from the same origin (bundled).
    *   Communicates with the Host via `Comlink`.
    *   Handles the API calls to Gemini/Chrome AI.
    *   Creates the *Renderer Iframe*.

3.  **Renderer Iframe (Sandboxed)**:
    *   Loaded via a `Blob` URL.
    *   **Sandbox Attributes:** `allow-scripts allow-forms`.
    *   **Crucially Missing:** `allow-same-origin`. This treats the origin as opaque/null.
    *   The generated HTML/JS runs here. It cannot access the Coordinator's variables (API Key) or the Host's LocalStorage/Cookies.

## Development

*   **Build:** `npm run build`
*   **Preview:** `npm run preview`

## Requirements

*   **Gemini Provider:** A valid Google Cloud API Key with access to Gemini models.
*   **Chrome AI Provider:** Requires Chrome Canary/Dev with `Optimization Guide On Device Model` enabled and necessary flags.
