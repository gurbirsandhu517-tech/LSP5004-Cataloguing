# LSP5004 Cataloguing Practice

A one-box AACR2 practice cataloguing tool.

## AI setup on Render

Add these Environment Variables in **Render → Service → Environment**:

- `GEMINI_API_KEY` = your Google AI Studio Gemini API key
- `GROQ_API_KEY` = your Groq API key

Optional:
- `GEMINI_MODEL` = `gemini-3.8-flash`
- `GROQ_MODEL` = `openai/gpt-oss-20b`

The app tries **Gemini first**. If Gemini is unavailable, errors, or reaches its quota, the app automatically tries **Groq**. The API keys stay on the server and are not placed in browser JavaScript.

## Render

Build command:
`npm install`

Start command:
`npm start`

After adding/changing Environment Variables, redeploy the service.

## Features

- Section A/B/C/D
- Paste the complete cataloguing question in one box
- AI extracts only facts supplied in the question
- Gemini primary + Groq fallback
- Generated catalogue entry result
- Copy entry
- Download catalogue entry as PDF
- `/health` endpoint to confirm that the server is running and whether each provider key is configured

## Important

This is a practice tool. Final cataloguing decisions should be checked against the authorised course/reference material.
