# LSP5004 V19 — AACR2 Fast Gemini All-Entries Engine

- Gemini primary with automatic model discovery.
- Google Search grounding first; direct Gemini retry if grounding fails.
- Fast timeouts and immediate structured AACR2 fallback instead of a blank error.
- Accepts `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_GEMINI_API_KEY`, or `API_KEY`.
- If the server has no key, the browser can use a Gemini key for the current session only.
- Unlimited justified catalogue entries and continuation cards.
- Automatic main/additional/series/uniform-title/subject cards from the returned structured answer.
- Main-card tracing is generated from the entries actually prepared.
- Traditional 12.5 × 7.5 cm catalogue cards and working PDF export.
- No A/B/C/D restriction.

## Render
Set `GEMINI_API_KEY` in Render Environment Variables. Optional: `GEMINI_MODEL`. Then deploy with `npm install` and `npm start`.

The app exposes `/health` and `/version` for a quick deployment check.
