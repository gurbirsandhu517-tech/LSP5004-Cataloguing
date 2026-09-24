# LSP5004 V42 — Professional Fast AACR2 Catalogue Card Engine

V42 is the professional fast catalogue-card build for LSP5004.

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
- Traditional AACR2 paragraph indentation: each catalogue field starts at its own indentation, and every wrapped line returns to that field start.
- Subjects and tracing are separated into readable numbered lines when multiple entries are supplied.
- Imprint, physical description, notes, subjects, series, identifiers and tracing are kept in the same main catalogue card until genuine physical overflow.
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


## V42 all-material parser fix
- /generate has a hard-bounded Gemini attempt and deterministic AACR2 fallback so external model failures do not hold the request long enough to trigger Render 502s.
- One complete question produces one main card; continuation cards are used only for physical overflow.
- PDF consumes the exact validated card lines and uses the same 8-row physical capacity.

## V42 material handling fix
- All Materials automatically detects the applicable material type from the complete question.
- Selecting Book, Serial Publication, Map, Motion Picture, Video Recording, Sound Recording, Electronic Resource, or Microform applies that specific treatment.
- Material-type words that are part of a real title (for example, “Journal of …”) are preserved as title text rather than stripped as labels.
- Natural-language questions and labelled fields are both accepted.


## Version marker
Version marker: V42

The PDF filename and deployed server version are also V42.
