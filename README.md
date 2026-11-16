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

## Agent and CI CLI

The project pins `agent-browser` as a development dependency. Its native CLI drives Chrome directly; there is no Playwright dependency or test runner. The apartment CLI uses Node's standard library and the same commands for agents and CI.

```sh
npm ci
npx agent-browser install
npm run dev
```

In another terminal:

```sh
npm run apartment -- open
npm run apartment -- inspect
npm run apartment -- view 2d
npm run apartment -- layer measurements on
npm run apartment -- view 3d
npm run apartment -- camera 10 8 10
npm run apartment -- screenshot test-results/my-view.png
npm run apartment -- browser snapshot -i
npm run apartment -- close
```

`open --url https://YOUR-PREVIEW.vercel.app` targets a hosted preview. Use `--session bedroom-review` on **every** interactive command to choose a separate session, or omit it to use a stable session unique to this checkout. Interactive commands keep Chrome open between calls; `close` ends that session. `--headed` shows the browser. `--help` lists all commands.

Commands emit JSON; failures exit nonzero. Use `node scripts/apartment.mjs ...` or `npm run --silent apartment -- ...` for clean machine output. `browser` passes raw commands through to agent-browser; put apartment options before `browser`, e.g. `npm run apartment -- --session bedroom-review browser snapshot -i`. Raw output refs stay valid only while their elements survive: take another snapshot after page changes. Load version-matched browser guidance with `npx agent-browser skills get core` before agent use.

The small in-page `window.apartment` API has `version: 1`, `getState()` and `setCamera([x,y,z])`. Inspection returns rooms, opening/wall counts, view, layers, camera position/target, actual WebGL draw statistics and context health. View/layer CLI commands operate the existing UI. Camera coordinates use the model's metres and require 3D view. This API is intentionally available in preview builds; it has no backend, file access or persistence.

### Repeatable browser checks

```sh
npm run build
npm run test:cli
npm run apartment -- test
npm run apartment -- test --url https://YOUR-PREVIEW.vercel.app
```

Without `--url`, `test` serves `dist/` on `127.0.0.1:4173` and stops that server when finished. Build first; the port must be free. With `--url`, it uses the existing app. Tests use isolated sessions, close them on completion/failure, write `test-results/browser/report.json`, and exit nonzero on failed assertions or browser startup failure. `--out path` changes the artifact directory. The CLI failure-path tests use Node's built-in test runner and do not require Chrome.

The suite checks actual geometry draws, label/measurement UI toggles, 2D/3D camera types, ceiling meshes, agent camera positioning, real pointer orbit and wheel zoom, the source trace, horizontal overflow, context loss, page errors and console errors. Desktop (1440 × 1000) and narrow (412 × 915) viewports each produce perspective, floor-plan, ceiling and camera PNGs. These are visual review evidence, not approved pixel baselines or proof of architectural accuracy. The narrow profile tests responsive layout, not mobile touch, Safari or physical-device GPU performance. Optional Google Fonts CSS is stubbed during smoke checks to keep that third party out of CI.

Every PR targeting `main` and push to `main` triggers `.github/workflows/browser-tests.yml`. It installs Chrome/system libraries, validates/builds the app and runs this same CLI with software WebGL for runners without GPUs. Open **PR → Checks → Browser tests → Details**, download **browser-report**, and inspect `report.json` and the PNGs. The workflow does not create a public preview URL.

For restricted environments, `npx agent-browser doctor` diagnoses launch failures. A custom installed Chrome can be selected with `AGENT_BROWSER_EXECUTABLE_PATH`. Other launch/provider settings use agent-browser's `AGENT_BROWSER_*` variables. The CLI does not bypass environment restrictions; if Chrome/the daemon cannot start, the suite reports failure. Browser reference: https://agent-browser.dev/commands.

### Vercel preview for this unmerged PR

`vercel.json` configures Vite, geometry validation, the production build and the `dist` output. A Vercel account/project connection is still required; configuration alone does not deploy anything.

To preview PR #1 without merging it, check out `feat/apartment-reconstruction`, run `npx vercel`, sign in, and link or create the project when prompted. This creates a preview deployment; omit `--prod`. For ongoing per-PR previews, connect this GitHub repository to the Vercel project. Once `main` contains the app, use `main` as the production branch. The current `main` contains only a README, so it cannot yet build this app.

Test a reachable deployed preview with the same suite:

```sh
npm run apartment -- test --url https://YOUR-PREVIEW.vercel.app
```

The preview must allow the test browser to reach the app; an authentication page will fail the test. No Vercel token or deployment secret is needed for the GitHub-hosted browser checks. Hosting reference: https://vercel.com/docs/frameworks/frontend/vite. Browser reference: https://agent-browser.dev/installation.

## Edit architecture

- `data/measurements.json`: all architectural dimensions, confidence, vertices, polygons, walls, openings and fixture placements.
- `docs/assumptions.md`: reliable evidence and unresolved discrepancies.
- `docs/geometry.md`: coordinates, methodology, validation limits and source comparison.
- `public/source-plan.svg`: matching top-down trace.

All spatial values are metres. Opening offsets follow each wall from a to b. Maintain shared vertex IDs when editing adjacent rooms. Run validation and compare against the source after edits. Fixture block dimensions and positions are configurable alongside the architecture.

## Accuracy

41.64 m² is printed in the plan. The traced partition is 38.56 m² (−7.39%); area conventions and wall/shaft allocation remain uncertain. The model was not stretched to conceal that difference. Only explicitly printed dimensions are verified. Coordinates, openings and fixture layouts are estimates; ceiling and other elevations are defaults. Suitable for spatial understanding, not construction.
