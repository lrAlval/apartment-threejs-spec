# Automation and browser checks

[README](../README.md) · [CI and deployment](deployment.md)

The apartment CLI uses Node's standard library and the pinned `agent-browser` development dependency to drive Chrome directly. No Playwright dependency or separate browser test runner.

## Setup

```sh
npm ci
npx agent-browser skills get core
npx agent-browser install
npm run dev
```

Read the version-matched `core` guidance before browser automation. If network-interface enumeration fails in a restricted environment, start Vite with `npx vite --host 127.0.0.1` instead.

## Inspect and capture

In another terminal:

```sh
npm run apartment -- open
npm run apartment -- inspect
npm run apartment -- view 2d
npm run apartment -- layer measurements on
npm run apartment -- view 3d
npm run apartment -- camera 10 8 10
npm run apartment -- view walk
# Drag to look; W A S D / arrows or hold movement-pad buttons.
# Reset position and Exit walkthrough are available in the UI.
npm run apartment -- view 3d
npm run apartment -- screenshot test-results/my-view.png
npm run apartment -- browser snapshot -i
npm run apartment -- close
```

Read state after actions; capture screenshots to inspect the canvas. `inspect` includes actual WebGL render and camera health.

| Option | Purpose |
| --- | --- |
| `--help` | List all commands |
| `open --url https://YOUR-PREVIEW.vercel.app` | Open a hosted preview |
| `--headed` | Show Chrome |
| `--session bedroom-review` | Select an explicit interactive session |

Omit `--session` to use a stable session unique to this checkout. If you specify one, use the same value on **every** interactive command, including `close`. Interactive commands keep Chrome open; finish with `close`.

Commands emit JSON and failures exit nonzero. For JSON-only output, use `node scripts/apartment.mjs ...` or `npm run --silent apartment -- ...`.

`browser` passes raw commands through to agent-browser. Put apartment options before it:

```sh
npm run apartment -- --session bedroom-review browser snapshot -i
```

Raw element refs last only while their elements survive. Take a fresh snapshot after page changes. [Browser command reference](https://agent-browser.dev/commands).

## In-page API

`window.apartment` exposes `version: 1`, `getState()`, `find(collection, id)` (a `rooms`/`walls`/`openings`/`soffits`/`fixtures` record from the Apartment model, or a thrown error) and `setCamera([x,y,z])`.

- State includes rooms, opening/wall counts, view, layers, camera position/target, actual WebGL draw statistics and context health.
- View/layer CLI commands use the existing UI. `view walk` enters eye-level walkthrough; `view 3d` or `view 2d` exits it. Camera positioning requires overview 3D; layer changes require exiting walkthrough.
- Walkthrough forces ceilings on, hides labels/measurements, and restores prior view/layers/camera on exit. Drag to look works on mouse and touch; movement buttons support held pointers and keyboard activation. Optional mouse lock requires a user click; Esc releases it. Focus/visibility loss clears held movement. Reset returns to the entrance-side starting point and refocuses the canvas so keyboard movement continues. Keyboard input accepts physical codes and key-only events. The narrow profile additionally injects native CDP multi-touch input to exercise simultaneous movement/look and release cleanup.
- The API is intentionally available in preview builds. It has no backend, file access or persistence.

## Repeatable checks

```sh
npm run test:cli
npm run validate
npm run build
npm run apartment -- test
```

To check an existing deployment instead:

```sh
npm run apartment -- test --url https://YOUR-PREVIEW.vercel.app
```

| Mode | Behavior |
| --- | --- |
| Local `test` | Serves `dist/` at `127.0.0.1:4173`, then stops the server. Build first; port must be free. |
| `test --url …` | Uses the existing app; an authentication page will fail checks. |
| `test --out path` | Changes the artifact directory. |
| `test:cli` | Runs CLI failure-path and shared collision/movement tests with Node's built-in runner and type stripping; no Chrome required. |

Browser tests use isolated sessions and close them on success or failure. Failed assertions or browser startup exit nonzero. **Blocked browser launch is a failed/unverified run, never a pass.**

### Review evidence

Inspect `test-results/browser/report.json` and its PNGs:

```text
Browser checks
├── Desktop: 1440 × 1000
└── Narrow:   412 × 915
    Each → perspective / floor-plan / ceiling / camera / walkthrough PNGs
```

Checks cover geometry draws, structural window/return state, label/measurement toggles, 2D/3D camera types, ceiling meshes, camera positioning, pointer orbit, wheel zoom, keyboard walkthrough movement, drag-look, held movement pad, reset/exit restoration, historical source trace availability, horizontal overflow, context loss, page errors and console errors. Optional Google Fonts CSS is stubbed to exclude that third party from CI.

Screenshots are review evidence, not approved pixel baselines or proof of architectural accuracy. The narrow profile checks responsive layout and emulated native multi-touch input, not Safari or physical-device GPU performance.

### Troubleshooting

- Run `npx agent-browser doctor` to diagnose launch failures.
- Select an installed Chrome with `AGENT_BROWSER_EXECUTABLE_PATH`; other launch/provider settings use `AGENT_BROWSER_*` variables.
- The CLI does not bypass environment restrictions. If Chrome or its daemon cannot start, the suite fails.

[Browser installation reference](https://agent-browser.dev/installation).
