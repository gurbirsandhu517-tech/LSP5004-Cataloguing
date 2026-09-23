# LSP5004 Cataloguing Practice — V8

## V8 Advanced AACR2 Multi-Page Catalogue Card Fix

This V8 keeps the existing version and fixes the answer structure so the system reads the **entire question** and produces **all applicable catalogue entries/access points justified by the question**.

### What it now does
- Reads the complete assignment question before generating the answer.
- If a complete catalogue card/entry is requested, it determines all applicable entries from the supplied facts rather than only answering explicitly named fields.
- Supports applicable main entry, title entry, personal-name/corporate-body added entries, subject entries, series/uniform-title entries and other access points when justified.
- Keeps multiple items/subquestions separate and in question order.
- Does not invent bibliographic facts.
- Uses `Not supplied` / `Verification required` where the question does not provide enough information.
- Renders each generated catalogue entry/access point in a ruled card with horizontal and vertical lines.
- PDF output uses the same entry-by-entry ruled-card structure.
- Keeps the deployment/version as V8.

### Important layout behaviour
- The answer is **not forced into one page**.
- Every applicable catalogue entry/access point is rendered as a ruled card row and the UI automatically creates continuation pages when the content is long.
- The PDF uses real A4 page breaks and repeats the catalogue-card heading on continuation pages.
- The card has a filing-margin vertical rule plus horizontal rules between each entry, following the supplied textbook/photo style.
- Bibliographic fields such as publisher/date/physical description are taken from the supplied question where those fields are explicitly present; the system does not intentionally fill missing facts with made-up data.
