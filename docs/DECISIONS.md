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

## No real Pascal JSON in Git

Residential JSON can reveal private layouts and private asset URLs. Import is
local-only, private file patterns are ignored, and the committed fixture is
wholly fictional and contains no geometry.

## No Pascal native geometry systems yet

Depending on Pascal Editor internals now would obscure the domain boundary and
turn a solar prototype into an importer project. A small `SceneSource` contract
and `scene/pascal` folder preserve the next integration seam without premature
abstractions.

## Stable fixed shadow frustum

The milestone-one directional light targets the house center and uses a fixed
orthographic shadow volume sized for the demo and ordinary shadow reach. This
avoids per-frame bounds changes and shadow-camera jumping during playback.
