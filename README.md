# LSP5004 V18 — AACR2 Unlimited Automatic All-Entries Engine

- Gemini primary; Google Search grounding with Gemini-only retry.
- No A/B/C/D section restriction.
- No catalogue-card count limit: every justified entry is represented; physical card capacity creates continuation cards only.
- Main entry + all justified personal/corporate/title/series/uniform-title/subject entries.
- Main-entry tracing is generated from the entries actually prepared.
- AACR2/ISBD-style punctuation and material-specific treatment.
- Traditional 12.5 × 7.5 cm catalogue cards with filing block.
- Long entries are split into continuation cards; no truncation in the generated card set.
- The engine does not invent missing bibliographic facts.

Deploy the contents of this folder to the Node service. Set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`).
