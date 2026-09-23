# LSP5004 V15 — AACR2 Serial Completeness + Gemini Fix

- Gemini remains primary; Google Search grounding remains enabled when Gemini is available.
- Gemini retries without grounding if the grounded request fails.
- If Gemini is unavailable, a structured fallback now parses complex serial/continuing-resource questions and generates separate MAIN, PERSONAL NAME, TITLE, and SERIES cards where supported by the supplied question.
- Serial completeness guard replaces an incomplete one/two-card Gemini serial result with the structured multi-entry result.
- No question text is returned as a catalogue answer.
- Card text is darker and larger for mobile readability.
- Cache busting updated to v15 and static assets use no-cache headers.
- 12.5 × 7.5 cm traditional catalogue-card layout remains.
