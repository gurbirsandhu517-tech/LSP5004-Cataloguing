# LSP5004 Cataloguing — Fixed

- One-box complete-question input.
- Gemini 3.8 Flash generation.
- Google Search grounding enabled.
- Catalogue result fields + AACR2 practice check.
- Working PDF endpoint and download button.
- Responsive mobile interface.
- Version remains 1.0.0.

## Render
Add `GEMINI_API_KEY` under Render → Environment and redeploy.
If the old `package-lock.json` is still present and does not include `@google/genai`, delete it before redeploying so npm installs the dependency from the new `package.json`.
