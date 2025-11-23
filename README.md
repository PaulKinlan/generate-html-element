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

### Using Template Context (Experimental)

You can provide structural context to influence the LLM's output by including a `<template>` element inside the `<generate-html>` component. The template content remains inert (not rendered) but is passed to the LLM as a reference structure.

```html
<generate-html
  prompt="Create a product card with pricing"
  api-key="YOUR_GEMINI_API_KEY"
  provider="gemini"
>
  <template>
    <div class="card">
      <h2>Card Title</h2>
      <p>Card description goes here</p>
      <button>Action</button>
    </div>
  </template>
</generate-html>
```

The LLM will use the template structure as a reference while following your prompt, making it easier to get consistent layouts or specific HTML structures.

### Attributes

| Attribute  | Description                                      | Default |
| :--- | :--- | :--- |
| `prompt`   | The text description of what to generate.        | (Required) |
| `api-key`  | Your Google Gemini API Key.                      | (Required for Gemini) |
| `provider` | `gemini` or `chrome-ai`.                         | `gemini` |
| `model`    | Model version (e.g., `gemini-2.5-flash-latest`). | `gemini-2.5-flash-latest` |
| `type`     | Output type: `html` (interactive) or `image` (SVG). | `html` |
| `sizing`   | `content` (auto-resize to content) or `fill` (100% height). | `fill` |
| `debug`    | Boolean. If present, logs debug info to console. | `false` |

## Security Architecture

This component handles untrusted AI-generated code. To prevent XSS and data leakage, it employs a **Double Iframe Strategy**:

1.  **Host Page (`<generate-html>`)**:
    *   Living in your application.
    *   Has access to the API Key.
    *   **Does NOT** render the generated content directly.

2.  **Coordinator Iframe (Hidden)**:
    *   **Source:** Inlined/Bundled (no separate network request).
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

## Project Structure

This is a monorepo containing:

*   `packages/generate-html`: The core web component package.
*   `packages/demo`: A demo application showcasing the component.
*   `src/`: Shared source files.

## Requirements

*   **Gemini Provider:** A valid Google Cloud API Key with access to Gemini models.
*   **Chrome AI Provider:** Requires Chrome Canary/Dev with `window.LanguageModel` API enabled.
