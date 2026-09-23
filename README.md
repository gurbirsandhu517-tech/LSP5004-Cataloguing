# LSP5004 V10 — Advanced AACR2 Catalogue Practice

## Features
- Gemini is the primary generation model.
- Google Search grounding is enabled inside the Gemini request; search results/links are not shown as the catalogue answer.
- Question-driven entries: no fixed entry count and no invented bibliographic facts.
- Catalogue cards are rendered at 12.5 cm × 7.5 cm.
- Horizontal and vertical catalogue-card rules.
- Call number and accession number occupy the card's left filing block; accession number is used only when supplied.
- Imprint → physical description → notes follow the requested catalogue sequence.
- Any number of cards can be generated; there is no artificial one-page limit.
- PDF output uses actual 12.5 × 7.5 cm pages.
- If Gemini is unavailable, the app explicitly reports fallback status rather than pretending the result was verified.

## Environment
Set:
- `GEMINI_API_KEY` (required for Gemini generation)
- optional `GEMINI_MODEL` (default `gemini-2.5-flash`)
- `PORT` is optional.

## Render
Build command: `npm install`
Start command: `npm start`

## Important
This is a cataloguing practice tool. The supplied question/reference remains the source of bibliographic facts. The app does not invent missing publisher, date, names, dimensions, call numbers, or accession numbers.
