# LSP5004 Cataloguing Practice — V8

## V8 Complete Catalogue-Card Fix

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
