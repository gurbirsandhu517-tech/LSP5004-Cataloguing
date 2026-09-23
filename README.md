# LSP5004 Cataloguing Practice

One-box AACR2 cataloguing practice tool with **Gemini primary + Groq fallback** and PDF generation.

## Required Render Environment Variables

Add these under **Render → your service → Environment**:

- `GEMINI_API_KEY` = your Google AI Studio API key
- `GROQ_API_KEY` = your Groq API key

Optional:
- `GEMINI_MODEL` = `gemini-2.5-flash`
- `GROQ_MODEL` = `openai/gpt-oss-20b`

The keys stay on the server and are not placed in browser JavaScript.

## Render settings

- Build Command: `npm install`
- Start Command: `npm start`

The repository root must contain:

```text
package.json
server.js
README.md
public/
  index.html
  script.js
  style.css
```

**Important:** do NOT create a folder named `public/index.html`. `index.html` must be a file directly inside `public`.

After changing Environment Variables, redeploy.

## Endpoints

- `/` — website
- `/health` — server/provider diagnostic
- `/generate` — AI catalogue generation
- `/generate-pdf` — PDF generation

The app tries Gemini first and automatically falls back to Groq if Gemini fails or is unavailable.
