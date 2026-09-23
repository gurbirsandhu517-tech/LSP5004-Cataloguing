# LSP5004 V17 — AACR2 Unlimited Cards + Serial Entry Fix

- Gemini remains primary; Google Search grounding remains enabled when Gemini is available.
- Gemini retries without grounding if the grounded request fails.
- Complex serial/continuing-resource questions are protected by a deterministic completeness guard.
- A serial answer can no longer collapse into a publisher-only MAIN ENTRY card.
- Serial fallback builds the title main entry, supported personal-name added entries, title added entry, and series added entry from supplied facts.
- AACR2/ISBD-style punctuation is normalized so symbols such as /, :, ;, . and — appear in the appropriate places.
- There is no catalogue-card count limit. Long entries are automatically split into continuation cards rather than truncated.
- PDF generation also expands long cards into continuation cards.
- Card size remains 12.5 × 7.5 cm.
- Card text is darker and larger for mobile readability.
- Cache busting updated to v16 and static assets use no-cache headers.
