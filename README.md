# Pascal Solar Study Demo

An independent engineering demo for validating solar position and building
shadows from a real location, local civil time, date, IANA time zone, and site
true-north orientation. It is a reference implementation for a future Pascal
Editor integration; it does not depend on the Pascal Editor repository.

## Current capabilities

- Editable latitude, longitude, IANA time zone, date, local time, and true-north offset.
- DST-aware conversion from project-local civil time to an absolute instant.
- Solar altitude, compass azimuth, world direction, light position, sunrise,
  solar noon, sunset, and horizon status.
- Real-time day and year sliders, looped playback, speed controls, seasonal
  shortcuts, and sunrise/noon/sunset jumps.
- React Three Fiber viewer with orbit/pan/zoom, dynamic shadows, sun path,
  sun marker, compass, grid, and optional world axes.
- A simplified two-storey shadow-test house with slabs, pitched roof, balcony,
  interior partition, and real door/window openings assembled from wall segments.
- Local-only Pascal JSON diagnostics that validate a top-level `nodes` object
  and count node types. Geometry import is intentionally deferred.

## Stack

React, TypeScript, Vite, Three.js, React Three Fiber, Drei, Zustand, SunCalc,
Luxon, Vitest, and ESLint. Luxon is the only additional runtime dependency
beyond the requested stack; it is used to handle IANA zones and daylight-saving
transitions without depending on the viewer's computer time zone.

## Run locally

```bash
npm install
npm run dev
```

Vite prints the local URL. The project uses the `/pascal-solar-study-demo/`
base path; Vite serves the correct development entry automatically.

## Checks and build

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run check
```

`npm run test` starts Vitest in watch mode. `npm run check` runs the full CI
sequence: type checking, lint, unit tests, and production build.

## GitHub Pages

The workflow at `.github/workflows/deploy-pages.yml` builds and deploys the
site on pushes to `main` and can also be run manually. In the GitHub repository,
set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
Vite's base path is `/pascal-solar-study-demo/`, matching this repository name.
No client router is used, so page refreshes resolve through `index.html`.

## Coordinate and angle conventions

The Three.js world is Y-up:

- `+Y`: up
- `+Z`: demo scene north
- `+X`: demo scene east

Displayed solar azimuth is a compass bearing: `0°` true north, `90°` true east,
`180°` true south, and `270°` true west, increasing clockwise. SunCalc v2
already returns this convention; the solar domain still normalizes it at a
single explicit boundary.

`northOffsetDeg` is the clockwise rotation from scene `+Z` to true north:

- `0°`: `+Z` is true north
- `90°`: `+X` is true north
- `180°`: `-Z` is true north
- `270°`: `-X` is true north

Changing true north rotates the solar bearing into scene coordinates; it never
rotates the building. `worldDirection` points from the scene center toward the
Sun. The physical light rays propagate in the opposite direction. The Three.js
directional light is placed along `worldDirection` and targets the house center.

## Module boundaries

- `src/solar/`: pure TypeScript calculations; no React, Zustand, or R3F imports.
- `src/state/`: editor inputs, playback settings, and display options.
- `src/scene/demo/`: replaceable milestone-one building source.
- `src/scene/pascal/`: JSON validation and the future Pascal rendering boundary.
- `src/components/`: UI controls and local file diagnostics.

## Current limitations

- The house is deliberately simplified and not reconstructed from Pascal JSON.
- The sun path is sampled every ten local minutes.
- Atmospheric effects, terrain, neighboring buildings, glass transmission,
  and material-specific optical properties are not modeled.
- Sunrise and sunset can be unavailable at high latitudes; the UI displays `—`
  and disables the corresponding jump button.
- The fixed shadow frustum is sized for this demo house, not arbitrary imports.

Pascal geometry rendering will be implemented in the next milestone. Real
residential JSON and private asset URLs must never be committed.

> This demo is not a code-compliant illuminance, solar-radiation, energy, glare,
> or daylight-certification analysis tool.
