# Repository rules for coding agents

## Goal

Maintain an independent solar-and-shadow reference demo that can later inform
Pascal Editor integration. Prefer clear, inspectable engineering behavior over
photorealistic rendering.

## Required stack

React, TypeScript in strict mode, Vite, Three.js, React Three Fiber, Drei,
Zustand, SunCalc, Luxon, Vitest, ESLint, and npm. Do not add a backend,
database, large UI framework, or Pascal Editor repository dependency.

## Coordinate contract

The world is Y-up: `+Y` up, `+Z` scene north, and `+X` scene east. Solar
azimuth is clockwise from true north. `northOffsetDeg` rotates clockwise from
scene `+Z` to true north. Rotate the solar bearing into scene coordinates;
never rotate the building to apply true north.

## Module boundaries

- Keep `src/solar` pure TypeScript and free of React, Zustand, R3F, and Pascal
  renderer imports.
- Keep scene-source decisions behind `src/scene/SceneSource.ts`.
- Keep the demo house in `src/scene/demo`.
- Keep all Pascal validation/import preparation in `src/scene/pascal`.
- Do not couple the solar domain to a Pascal renderer or model schema.

Do not use `any` to bypass core solar, time-zone, scene-source, or Pascal node
types. Do not suppress or quietly ignore TypeScript errors.

## Tests and verification

Solar changes must include meaningful tests for direction, time ordering, and
time-zone behavior rather than merely asserting that values are numeric.
Coordinate-convention changes require explicit 0° and 90° north-offset tests.

After modifications, run:

```bash
npm run check
```

Fix all failures before handing off. For visible or interaction changes, also
run the development server and inspect the page and browser console.

## Private data

Never commit real Pascal residence JSON, real floor plans, private asset URLs,
or files matching `*.private.pascal.json`. Keep local models under the ignored
`local-models/` folder. A tiny, wholly fictional test fixture is acceptable.
