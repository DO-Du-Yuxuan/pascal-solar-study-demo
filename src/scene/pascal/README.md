# Pascal import boundary

The app loads a confirmed sanitized default Pascal JSON from `public/models/`.
Users can still select another JSON, which is parsed only in browser memory and
never uploaded. The raw document is converted by `parsePascalScene` into
renderer-facing levels, walls, openings, analytical openings, surfaces, roofs,
trees, and an exhaustive import report. React components do not traverse the
raw export.

Private residence exports stay under the ignored `local-models/` directory.
Unsupported and deliberately ignored node types are reported instead of being
silently discarded.
