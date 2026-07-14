# Technical decisions

## SunCalc for solar astronomy

SunCalc is small, established, and directly returns solar position and daily
events. Version 2 returns degrees using the product's north-based clockwise
azimuth convention. The domain normalizes that boundary explicitly and tests it
instead of duplicating a complete astronomical algorithm.

## Luxon for project-local civil time

JavaScript `Date` alone does not conveniently construct an instant from an
arbitrary IANA project zone. Luxon provides explicit zone conversion and DST
behavior with a small, focused API. Tests assert exact winter and summer UTC
instants so the result cannot depend on the developer machine zone.

## Simplified residence for milestone one

A hand-built two-storey model makes shadow behavior inspectable and keeps the
first milestone focused on solar correctness. Segmented walls create actual
openings without adding CSG complexity.

## Fixed building, rotated solar coordinates

World axes are `+Y` up, `+Z` scene north, and `+X` scene east.
`northOffsetDeg` rotates clockwise from scene `+Z` to true north. The building
is never rotated by this control; only solar bearings are mapped into scene
coordinates.

## Sanitized default Pascal model

Residential JSON can reveal private layouts and asset URLs. The deployed
default model is an explicitly confirmed sanitized presentation export stored
under `public/models/`. Other user-selected exports remain browser-local, and
private file patterns plus `local-models/` stay ignored.

## Local Pascal conversion boundary

The browser reads the sanitized default export or a user-selected local export
and converts raw nodes into a small renderer-facing model. Pascal hierarchy
recovery and validation stay in `scene/pascal`; React renders only parsed
levels, wall pieces, surfaces, roofs, and trees. No Pascal Editor runtime
dependency or remote upload is introduced.

## Bounds-driven shadow frustum

The imported renderer measures the actual building-and-tree bounds once after
an import. The camera, directional-light target, and stable orthographic shadow
volume derive from those bounds, so distant or tall trees remain included while
solar playback changes only the light direction.

## Analysis-oriented roof geometry

Pascal roof nodes are converted into lightweight gable, hip, shed, and flat
shadow geometry. Gambrel, mansard, dutch, and multi-segment intersections stay
explicitly marked as approximations because solar obstruction is the goal, not
editor-identical construction detailing.

## Static NASA POWER history

The browser never calls NASA at runtime. It parses the committed official
extended hourly CSV, including its preamble, units, and missing-value markers.
The UI converts Bellevue civil time to UTC and uses source irradiance only to
drive qualitative lighting; climate summaries use the original hourly values.
