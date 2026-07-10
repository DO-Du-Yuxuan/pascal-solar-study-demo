# Product specification

## Purpose

Provide a standalone web demo that validates solar position and simplified
building shadows using real geographic coordinates, a project-local date and
time, an IANA time zone, and a configurable true-north direction. The code is a
future integration reference for Pascal Editor, not a dependency on it.

## Inputs

- Latitude (`-90…90`) and longitude (`-180…180`)
- IANA time zone with DST-aware local-to-instant conversion
- Local date and minutes since midnight (`0…1439`)
- True-north offset (`0…359°`)
- Continuous day/year sliders, playback speeds, loop settings, seasonal dates,
  and sunrise/noon/sunset jumps
- Sun-path, grid, and axes visibility

## Outputs

Display solar altitude and compass azimuth, the unit world direction, light
position, sunrise, solar noon, sunset, horizon status, and local timestamp.
Below the horizon the direct directional-light intensity is zero.

## Coordinates

The scene is Y-up with `+Z` scene north and `+X` scene east. Azimuth is
clockwise from true north. `northOffsetDeg` is clockwise from scene `+Z` to
true north; changing it remaps the Sun and does not rotate the building.

## Scene

Use a perspective camera, orbit controls, large receiving ground, directional
sun light, soft ambient fill, compass, optional axes/grid, sun marker, sampled
daily path, and dynamic shadows. The first scene source is a simplified
two-storey residence with real wall openings, slabs, roof, interior partition,
balcony/overhang, and door opening. Major solids cast and receive shadows.

## Pascal milestone-one boundary

Read a selected JSON file only in the browser. Require a top-level `nodes`
object and report total/type counts. Do not upload it or render its geometry.
Never store real residential JSON in the repository.

## Quality bar

The solar domain must be independent of React and scene models. Unit tests must
cover compass mapping, true-north rotation, vector normalization, night state,
meaningful daily altitude relationships, sun-time ordering, and machine-zone
independence. The complete typecheck, lint, tests, and production build must pass.

## Non-goals

No complete Pascal reconstruction, backend, database, HDRI, GI, ray tracing,
photorealism, illuminance compliance, radiation, or energy analysis.
