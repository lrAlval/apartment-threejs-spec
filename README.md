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

## Cloud browser testing and live previews

Every PR targeting `main` (including updates to this PR) and every push to `main` triggers `.github/workflows/browser-tests.yml` on GitHub-hosted Ubuntu. It validates geometry, builds the production app, then tests desktop and mobile Chromium using software WebGL (no cloud GPU required).

The browser test requires actual geometry draw calls, exercises 2D/3D views, layers, orbit and zoom, checks for browser errors and horizontal overflow, and checks that the source trace is available. Each device produces perspective, floor-plan, ceiling and camera screenshots. These are review evidence, not approved visual baselines or proof of architectural accuracy. Mobile Chromium emulation does not verify Safari or physical-device GPU performance.

On the PR, open **Checks → Browser tests → Details**. Download the **browser-report** artifact from the workflow run, extract it, and open `playwright-report/index.html`. Failure traces and videos are included when available. Tests run against the built app served inside the cloud runner; this does not create a public preview URL.

Run the same checks locally:

```sh
npm ci
npx playwright install chromium
npm run build
npm run test:e2e
npm run test:e2e:report
```

### Vercel preview for this unmerged PR

`vercel.json` configures Vite, geometry validation, the production build and the `dist` output. A Vercel account/project connection is still required; configuration alone does not deploy anything.

To preview PR #1 without merging it, check out `feat/apartment-reconstruction`, run `npx vercel`, sign in, and link or create the project when prompted. This creates a preview deployment; omit `--prod`. For ongoing per-PR previews, connect this GitHub repository to the Vercel project. Once `main` contains the app, use `main` as the production branch. The current `main` contains only a README, so it cannot yet build this app.

Test a reachable deployed preview with the same suite:

```sh
PLAYWRIGHT_BASE_URL=https://YOUR-PREVIEW.vercel.app npm run test:e2e
```

The preview must allow the test browser to reach the app; an authentication page will fail the test. No Vercel token or deployment secret is needed for the GitHub-hosted browser checks. Hosting reference: https://vercel.com/docs/frameworks/frontend/vite. CI reference: https://playwright.dev/docs/ci.

## Edit architecture

- `data/measurements.json`: all architectural dimensions, confidence, vertices, polygons, walls, openings and fixture placements.
- `docs/assumptions.md`: reliable evidence and unresolved discrepancies.
- `docs/geometry.md`: coordinates, methodology, validation limits and source comparison.
- `public/source-plan.svg`: matching top-down trace.

All spatial values are metres. Opening offsets follow each wall from a to b. Maintain shared vertex IDs when editing adjacent rooms. Run validation and compare against the source after edits. Fixture block dimensions and positions are configurable alongside the architecture.

## Accuracy

41.64 m² is printed in the plan. The traced partition is 38.56 m² (−7.39%); area conventions and wall/shaft allocation remain uncertain. The model was not stretched to conceal that difference. Only explicitly printed dimensions are verified. Coordinates, openings and fixture layouts are estimates; ceiling and other elevations are defaults. Suitable for spatial understanding, not construction.
