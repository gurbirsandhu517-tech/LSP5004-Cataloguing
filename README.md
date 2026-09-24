# LSP5004 V25 — Advanced AACR2 Catalogue Card Engine

V25 is the advanced catalogue-card build for LSP5004.

## Core behavior
- Gemini is the primary generation engine.
- Google Search grounding is attempted first; direct Gemini is retried if grounding fails.
- The complete question is analysed; there is no A/B/C/D restriction.
- The engine prepares every **justified** main/added/series/uniform-title/subject access point supported by the question and AACR2 practice.
- No artificial catalogue-card limit.
- Long entries are automatically split into continuation cards rather than clipped.
- Main-card tracing is generated from the access points actually prepared and may continue when the first card is full.
- No bibliographic facts are invented when they are absent from the question.

## Traditional card layout
- Card size: **12.5 cm × 7.5 cm (5 × 3 in)**.
- Vertical indention/ruling lines and horizontal ruling lines.
- Call number in the upper-left filing block.
- Accession number in the requested **5th-line practice position** on the main entry card when supplied.
- Hanging/continuation indentation for the catalogue text.
- PDF output uses the same physical card size.

## Render deployment
Set `GEMINI_API_KEY` in Render Environment Variables. The app also accepts `GOOGLE_API_KEY`, `GOOGLE_GEMINI_API_KEY`, or `API_KEY`.
Optional: `GEMINI_MODEL`.

The browser can provide a session-only Gemini key if the server has no configured key, but a Render deployment should use an environment variable rather than asking the user every time.

Endpoints:
- `/health`
- `/version`
- `/generate`
- `/generate-pdf`
