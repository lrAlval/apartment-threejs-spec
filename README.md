# Apartment 09 · Three.js reconstruction

A lightweight, provisional spatial model of DPTO 309–2009, 2209, 2309, 2509, based on the supplied architectural plan. TypeScript, React Three Fiber, Drei and Vite. No backend.

## Run

Node.js 22.12+ recommended.

```sh
npm ci
npm run validate
npm run dev
```

Open the URL printed by Vite. Build with `npm run build`; inspect production with `npm run preview`. If a restricted environment cannot enumerate network interfaces, run `npx vite --host 127.0.0.1`.

Orbit with drag, pan with right drag, zoom with scroll/pinch. Choose 2D floor plan to disable rotation and cut walls down. Toggle ceiling, room labels and estimated bounding dimensions. Ceiling applies in 3D; full coverage intentionally hides interiors. Switch it off to inspect rooms. Gold reference rails mark doors; blue glazing marks windows. Open the traced comparison from the sidebar.

## Edit architecture

- `data/measurements.json`: all architectural dimensions, confidence, vertices, polygons, walls, openings and fixture placements.
- `docs/assumptions.md`: reliable evidence and unresolved discrepancies.
- `docs/geometry.md`: coordinates, methodology, validation limits and source comparison.
- `public/source-plan.svg`: matching top-down trace.

All spatial values are metres. Opening offsets follow each wall from a to b. Maintain shared vertex IDs when editing adjacent rooms. Run validation and compare against the source after edits. Fixture block dimensions and positions are configurable alongside the architecture.

## Accuracy

41.64 m² is printed in the plan. The traced partition is 38.56 m² (−7.39%); area conventions and wall/shaft allocation remain uncertain. The model was not stretched to conceal that difference. Only explicitly printed dimensions are verified. Coordinates, openings and fixture layouts are estimates; ceiling and other elevations are defaults. Suitable for spatial understanding, not construction.
