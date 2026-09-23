LSP5004 Cataloguing Practice — V9

AACR2 multi-card practice build.

Key behaviour:
- Reads the complete question before generating.
- Uses Gemini first, Groq second, then a local supplied-facts fallback.
- Does not fabricate bibliographic facts when the question does not supply them.
- Keeps applicable catalogue entries/access points as separate ruled card rows.
- Supports multiple catalogue cards/pages with automatic continuation.
- Card dimensions: 12.5 cm × 7.5 cm.
- Horizontal and vertical rules are used to reproduce a traditional catalogue-card layout.
- PDF output uses one 12.5 × 7.5 cm card per PDF page and continues for as many cards as required.
- Imprint/publication information is followed by physical description, notes and applicable entries rather than forcing every possible field into every card.
- Call number and accession number are preserved when supplied by the question/AI result; no values are invented.

Deploy on Render:
1. Upload/extract this ZIP into the repository.
2. Set GEMINI_API_KEY (recommended) and/or GROQ_API_KEY in Render environment variables.
3. Build: npm install --no-audit --no-fund
4. Start: npm start
5. Health: /health
6. Version: /version
