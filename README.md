# LSP5004 Cataloguing — GENERATE V3

This version fixes BOTH sides of the Generate problem:

- Generate button is bound after DOM load and exposed as `window.generateCatalogue`.
- `/generate` exists in `server.js`.
- Gemini is tried first, Groq second.
- If the server/AI request fails or times out, the browser creates a local catalogue answer from the supplied question, so the **ANSWER box still appears**.
- The result section is explicitly labelled **ANSWER — Generated Catalogue Entry** and automatically scrolls into view.
- Static files are served with no-cache headers to reduce old JavaScript being used.
- `/version` returns `GENERATE-V3-20260923`.

## Render
Upload the contents of this project so `server.js`, `package.json`, and `public/` are at the repository root. Redeploy. Then open `/version`; it must show `GENERATE-V3-20260923`.


## V5 visual update
The generated answer is presented as a ruled catalogue card with horizontal writing lines and a vertical catalogue margin/rule, while preserving the dynamic requested-entry section.
