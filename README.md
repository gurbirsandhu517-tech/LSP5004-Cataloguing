# LSP5004 Cataloguing — Generate Fixed

This is the COMPLETE project, not only `script.js`.

## Important fix
The Generate button calls `POST /generate`. The previous deployed `server.js` did not contain that route, so the button could not generate an entry. This version includes the `/generate` route with Gemini primary and Groq fallback, plus the PDF route.

## Render
1. Replace the GitHub repository files with ALL files from this ZIP.
2. Make sure `server.js`, `package.json`, and the `public/` folder are in the repository root structure shown here.
3. In Render → Environment, set `GEMINI_API_KEY`. Optionally set `GROQ_API_KEY` as fallback.
4. Redeploy the latest commit.
5. Open `/health` to confirm the server is running and see which provider keys are configured.

Do not put API keys in `public/` or frontend JavaScript.
