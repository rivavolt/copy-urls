Copy Selected Tab URLs (WXT)

Overview
- Chrome extension built with WXT (MV3).
- Clicking the extension button copies all highlighted tabs' URLs (one per line) to the clipboard. If no tabs are highlighted, it falls back to the active tab.

Dev Setup
- Requirements: Node 18+, pnpm/npm, Chrome 116+.
- Install deps: `npm install` (or `pnpm install`).
- Start in dev (serves and watches): `npm run dev`.
- Build production bundle: `npm run build` (outputs to `dist/`).

Load in Chrome
- Build with `npm run build`.
- Open `chrome://extensions` and enable Developer mode.
- Click "Load unpacked" and select the `dist/` folder.

How It Works
- On action click, the background service worker queries `highlighted` tabs in the current window and builds a newline-separated list of URLs.
- It spins up an offscreen document (`offscreen.html`) with the `offscreen` + `clipboardWrite` permissions to write to the clipboard, posts the text to it, then closes the offscreen document.

Files
- `src/entrypoints/background.ts`: Handles the action click and clipboard flow.
- `public/offscreen.html` + `public/offscreen.js`: Offscreen page that performs `navigator.clipboard.writeText`.
- `src/manifest.ts`: WXT manifest definition (permissions, action, etc.).
- `wxt.config.ts`, `tsconfig.json`, `package.json`: Project config.

Notes
- The extension uses Chrome's Offscreen Documents API; ensure your Chrome version supports it. If needed, we can switch to executing a copy script in the active tab instead.

