# Agent Instructions for `<generate-html>` Project

This repository contains a Vanilla JavaScript Web Component `<generate-html>` that uses LLMs (Gemini or Chrome AI) to generate interactive HTML or SVG content.

## Core Architecture: Double Iframe

Security is paramount. We use a **Double Iframe** pattern to isolate the generated content from the host page and the API keys.

1.  **Layer 1: Host Page**
    *   Contains the `<generate-html>` custom element.
    *   Holds the API Key and configuration attributes (`prompt`, `model`, `api-key`).
    *   Communicates with Layer 2 via `Comlink`.

2.  **Layer 2: Coordinator Iframe**
    *   **Source:** Inlined from `src/coordinator.html` via virtual module.
    *   **Role:** Orchestrates the LLM calls.
    *   **Libraries:** `@google/genai`, `comlink`.
    *   **Security:** Same-origin (usually) to allow easy loading, but logic isolates it from rendering.
    *   **Logic:** Receives prompt/config from Host. Calls LLM. Creates Layer 3.

3.  **Layer 3: Renderer Iframe**
    *   **Source:** Dynamic `Blob` URL created by Coordinator.
    *   **Role:** Displays the raw HTML/SVG output from the LLM.
    *   **Security:** **Strict Sandbox** (`allow-scripts allow-forms`). **NO `allow-same-origin`**.
    *   **Isolation:** Cannot access `localStorage`, `cookies`, or the Coordinator's context.

## Tech Stack

*   **Framework:** None (Vanilla JS Web Components).
*   **Bundler:** Vite.
*   **LLM SDK:** `@google/genai` (New SDK) for Gemini.
*   **Browser AI:** `window.ai.languageModel` (Experimental Chrome AI).
*   **Communication:** `comlink` (for Host <-> Coordinator).

## Operational Guidelines

### 1. Modifying `coordinator.js`
*   **Import Caution:** Use `import { GoogleGenAI } from '@google/genai';`.
*   **Sanitization:** Ensure markdown code blocks (```html) are stripped before rendering.
*   **Rendering:** Always render into the nested iframe using a Blob URL. Never `document.write` into the coordinator itself.

### 2. Modifying `<generate-html>` (Host Component)
*   **Observation:** The component observes attributes. Complex updates should trigger the `triggerGeneration()` method.
*   **Iframe Source:** The Coordinator iframe `src` is set to a Blob URL created from the inlined HTML string.
*   **Sizing:** The component supports a `sizing="content"` attribute. It listens for `generated-content-resize` messages from the coordinator to adjust its height.

### 3. Testing
*   **Manual:** Use `npm run dev` and open `http://localhost:5173`.
*   **Automated:** Use Playwright for visual verification.
    *   Scripts live in `verification/` (created on demand).
    *   Ensure the shadow DOM and nested iframes are accessible in tests.

### 4. Build
*   Run `npm run build` to generate the production assets.
*   The build produces a single JS bundle for the custom element (with the coordinator inlined).

## Common Pitfalls to Avoid
*   **Do not** give the Renderer iframe `allow-same-origin`.
*   **Do not** put the API key in the generated content (Layer 3).
*   **Do not** mix up `@google/generative-ai` (Old SDK) with `@google/genai` (New SDK).
