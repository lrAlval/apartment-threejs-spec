# Save plugin contract: research findings

Ticket: `04-save-plugin-contract.md` (`wayfinder:research`).

Question: what is the minimal dev-only Vite middleware that reads and writes `data/*.json` safely (path allowlist, atomic write, schema validation via the existing validate script before writing), and how does the client detect that saving isn't available in a production build?

Scope: research only. No code in `src/` or `scripts/` was changed.

## Answer in brief

1. Use a Vite plugin with `apply: 'serve'` and a `configureServer` hook that registers a plain connect middleware. The hook runs after Vite's CORS and host-validation middleware and before static serving and SPA fallback, so the handler sees every `/__data-save/...` request.
2. `npm run validate` cannot validate a candidate document today. `scripts/validate.mjs` statically imports `data/measurements.json` and asserts on that file only. It must first be refactored into a pure `validateMeasurements(data)` function, with the CLI kept as a thin wrapper.
3. `npm run dev` binds `0.0.0.0`. Vite's host check does not stop LAN peers. The plugin must check that the socket peer is loopback before it accepts writes.
4. The client cannot detect the API from the status code alone. Vite's SPA fallback answers any GET whose `Accept` is `*/*` with `index.html` and status 200, which is what `fetch()` sends by default. The probe must require a JSON body with a known marker.
5. The validator asserts `status === 'estimated'` for every room ceiling and every soffit. The map's `edited` status would therefore fail validation. This is a real conflict that needs a decision before implementation.
6. The data file is CRLF in the working copy and LF in git's index. A writer must keep the existing line endings or it rewrites every line.

## Versions

- Vite is pinned in `package-lock.json` at `7.3.8`; `package.json` declares `^7.0.0`. Findings below are from the 7.3.8 npm tarball (`npm pack vite@7.3.8`). The npm registry's `latest` is `8.3.8`. Vite 8 was not evaluated, so the API may differ there.
- Node is `v26.1.0` locally. `validate.mjs` imports `.ts` files directly and needs Node 22.18+ (type stripping on by default, per the Node release notes). No `engines` field or `.nvmrc` exists.

## Sources

Vite 7.3.8 (`package/dist/node/` in the npm tarball):

- `index.d.ts` L2796: `Plugin.apply?: "serve" | "build" | fn`.
- `index.d.ts` L2475: `ServerHook` return type; L2842: `configureServer?: ObjectHook<ServerHook>`; L2852: `configurePreviewServer`.
- `index.d.ts` L2490: `ViteDevServer.middlewares: Connect.Server`; L2553: `ssrLoadModule(url, opts?)`.
- `index.d.ts` ~L580-592: docs for `server.host` (`0.0.0.0` listens on LAN) and `server.allowedHosts` (localhost, `.localhost` and IPs allowed by default; `true` disables the check and enables DNS-rebinding exposure).
- `chunks/logger.js` L224: `defaultAllowedOrigins` regex (`localhost`, `127.0.0.1`, `[::1]`, any port). Used as the default `server.cors.origin`.
- `chunks/config.js` ~L20518-20561: `isHostAllowed`.
- `chunks/config.js` L25589: `rejectInvalidRequestMiddleware` (rejects URLs containing `#` with 400).
- `chunks/config.js` ~L25835-25900: middleware order in dev server creation. Sequence: debug (optional), `rejectInvalidRequest`, `cors`, `hostValidation` (unless `allowedHosts: true` or https), then `configureServer` pre-hooks, then transform, public, raw-fs, static, `htmlFallback`, `indexHtml`, 404, error. The returned post-hooks run after `htmlFallback`.
- `chunks/config.js` L22260-22262: `htmlFallbackMiddleware` rewrites GET/HEAD to `index.html` when `Accept` is absent, empty, or includes `text/html` or `*/*`.
- `chunks/config.js` L25052: `indexHtmlMiddleware` (only for `.html` URLs).

libuv (`src/win/fs.c`, `v1.x`, fetched from GitHub): `fs__rename` calls `MoveFileExW(..., MOVEFILE_REPLACE_EXISTING)`, so `fs.rename` over an existing file works on Windows.

Node: release notes for v22.18.0 (`https://nodejs.org/en/blog/release/v22.18.0`): "Type stripping is enabled by default".

Repo (this worktree, branch from `main`):

- `package.json`: `dev` is `vite --host 0.0.0.0`; `validate` is `node scripts/validate.mjs`; `build` is `tsc --noEmit && vite build`.
- `vercel.json`: `buildCommand` is `npm run validate && npm run build`.
- `scripts/validate.mjs`: top-level assertions on `apartment` from `../src/apartment-model.ts`, which imports `../data/measurements.json` statically. Prints a summary and exits non-zero on the first failed assertion. Hard-codes `ceiling.status === 'estimated'` (L7), `soffit.status === 'estimated'` (L15) and printed area `41.64` within 20% (L32).
- `src/apartment-model.ts`: `createApartmentModel(measurements)` is already pure and takes data as an argument. The module-level singleton `apartment = createApartmentModel(raw)` is the only place the JSON is bound.
- `data/measurements.json`: the only file in `data/`. Top-level keys are `schemaVersion, metadata, coordinateSystem, defaults, vertices, perimeter, rooms, walls, openings, soffits, fixtures, balcony, dimensions, provenance`. Statuses: 56 `estimated`, 6 `verified`, 6 `default`. All 5 room ceilings and all 3 soffits are `estimated`.
- `git ls-files --eol data/measurements.json`: `i/lf w/crlf`.
- No `vite.config.*` exists in this worktree. The dev server runs on Vite defaults.

## Proposed contract

### Endpoints (dev only)

- `GET /__data-save/status` returns `200` with `application/json` and body `{"saveApi":1}`.
- `PUT /__data-save/<name>.json` with `Content-Type: application/json` and the full document as body.
  - `200` `{"ok":true}` when validation passes and the file is written.
  - `422` `{"errors":[...]}` when validation fails. Nothing is written.
  - `403` for a non-loopback peer or a cross-origin `Origin`.
  - `404` when `<name>.json` is not in the allowlist.
  - `415` for a non-JSON content type.
  - `413` when the body exceeds 1 MB.
  - `500` when the write fails. The temporary file is removed. The error is logged.

### Path allowlist

Never join client input into a path. The request name must match `/^[A-Za-z0-9_-]+\.json$/` and must appear exactly in `readdirSync(dataDir)` (read per request, so new Space and Design files need no restart). Resolve the path only from the matched directory entry.

### Security checks (dev server reachable on LAN)

1. Peer address: `req.socket.remoteAddress` must be `127.0.0.1`, `::1` or `::ffff:127.0.0.1`. Needed because `npm run dev` binds `0.0.0.0`. Vite's `allowedHosts` does not block LAN IP hosts.
2. `Origin`: if present, must equal `http://${req.headers.host}`. Vite's default CORS regex only restricts response headers, not whether the request reaches the middleware. A simple cross-site POST would otherwise be delivered.
3. `Content-Type: application/json` is required. It is not a CORS-simple type, so a cross-site page needs a preflight, and Vite's CORS config denies that preflight for foreign origins.
4. DNS rebinding is blocked by Vite's `allowedHosts` default, as long as `allowedHosts` is not set to `true` and https is not used. Do not change that setting.

### Validation before write

Refactor `scripts/validate.mjs` so the assertions live in a pure exported function (for example `validateMeasurements(data)` in a new module). The module should build its own model with `createApartmentModel(data)` and must not print or read the singleton on import. `validate.mjs` stays the CLI: it calls the function on `data/measurements.json` and prints the same summary. The Vercel build depends on that CLI, so its output and exit codes must not change.

The dev plugin loads that module with `await server.ssrLoadModule('/scripts/<module>.mjs')` and calls the function on the candidate body. Exceptions become `422` (assertion messages) or `422` with a message (`TypeError` on a malformed shape). Wrap the call in try/catch so the server does not crash.

Caveat (verify in an implementation spike): `ssrLoadModule` must handle `import raw from '../data/measurements.json' with { type: 'json' }` in the transitive import chain. The validator does not use the singleton, so the cached JSON does not matter.

The validator is invariant checks, not a JSON Schema. No JSON Schema exists in the repo, so shape errors surface as thrown `TypeError`s.

### Atomic write

1. Serialize the validated body: `JSON.stringify(body, null, 2)`, with EOL matching the existing file (`\r\n` if the current file contains `\r\n`, else `\n`). Key order is preserved. A round-trip check on the current file showed `JSON.stringify(JSON.parse(text), null, 2) + '\n'` equals the file after CRLF normalization, so a no-op save produces no diff.
2. Write to a temporary file in the same directory (`<name>.<pid>.<random>.tmp`) with flag `wx`. Then `fsync` and close.
3. `fs.rename(tmp, target)`. On Windows this maps to `MoveFileExW(MOVEFILE_REPLACE_EXISTING)` (see libuv). Retry briefly on `EPERM`, `EBUSY` or `EACCES`, because another process can hold the target open. If it still fails, remove the temporary file and return `500`.
4. Serialize writes in-process with a promise queue so two saves cannot interleave.

### Client detection

- Production build: the plugin is `apply: 'serve'` and never ships. `import.meta.env.DEV` is a standard Vite static flag (env docs; not re-verified against the source above). Use it to hide the save UI in builds.
- Runtime probe: `fetch('/__data-save/status')` and require `response.headers.get('content-type')` to contain `application/json` and the body to equal `{saveApi:1}`. Do not trust `response.ok` alone. `vite preview` has no `configureServer` (the plugin does not run there, and `configurePreviewServer` would be needed). Vercel and `vite preview` answer unknown GETs with `index.html`, because the SPA fallback matches `*/*`. Confirmed in Vite's fallback code for the dev server. Preview and Vercel behavior is inferred, not tested.

### Sketch (not implemented; for the implementation ticket)

```ts
// vite.config.ts (proposed; no config exists today)
import { defineConfig, type Plugin } from 'vite';
import { readdirSync, readFileSync, openSync, writeSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dataDir = fileURLToPath(new URL('./data/', import.meta.url));
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const send = (res: any, code: number, body: unknown) => {
  res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(body));
};

function dataSaveApi(): Plugin {
  let queue = Promise.resolve();
  return {
    name: 'data-save-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (url === '/__data-save/status') return req.method === 'GET' ? send(res, 200, { saveApi: 1 }) : send(res, 405, { error: 'GET only' });
        const match = /^\/__data-save\/([A-Za-z0-9_-]+\.json)$/.exec(url);
        if (!match) return next();
        if (req.method !== 'PUT') return send(res, 405, { error: 'PUT only' });
        if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) return send(res, 403, { error: 'loopback only' });
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(res, 403, { error: 'cross-origin' });
        if (!req.headers['content-type']?.startsWith('application/json')) return send(res, 415, { error: 'application/json required' });
        const name = readdirSync(dataDir).find(f => f === match[1]);
        if (!name) return send(res, 404, { error: `not in allowlist: ${match[1]}` });

        let size = 0; const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => { size += c.length; if (size > 1_000_000) req.destroy(); else chunks.push(c); });
        req.on('end', () => {
          queue = queue.then(async () => {
            const candidate = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const { validateMeasurements } = await server.ssrLoadModule('/scripts/measurements-rules.mjs');
            validateMeasurements(candidate); // throws -> 422 (wire up with try/catch)
            const target = join(dataDir, name);
            const text = readFileSync(target, 'utf8');
            const eol = text.includes('\r\n') ? '\r\n' : '\n';
            const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
            const fd = openSync(tmp, 'wx');
            try { writeSync(fd, JSON.stringify(candidate, null, 2).replace(/\n/g, eol) + eol); fsyncSync(fd); }
            finally { closeSync(fd); }
            renameSync(tmp, target); // add EPERM/EBUSY retry in the real implementation
            send(res, 200, { ok: true });
          }).catch(e => { send(res, 422, { errors: [String(e.message)] }); });
        });
      });
    },
  };
}

export default defineConfig({ plugins: [dataSaveApi()] });
```

The sketch omits: `readBody` error paths, `413` on oversize (currently destroys the socket), retry on rename, cleanup of the temp file on failure, and status-code split between `422` and `500`. The implementation must add them.

## Risks and decisions for the owner

1. Dev bind: `npm run dev` exposes the write API to the LAN. The loopback check blocks phone or LAN editing. The alternative is changing the dev script to `localhost`. This is a product decision.
2. Status enum conflict: `validate.mjs` requires `estimated` for every ceiling and soffit (L7, L15). The map says GUI edits mark `edited` and that editing `verified` downgrades it. Either the validator must accept `edited` (not `verified`, since GUI edits are not drawing-verified, per AGENTS.md) or GUI saves of ceilings and soffits will always fail. This needs a decision and a `scripts/` change, which triggers the CUPID check.
3. Area guard: the validator requires the trace area within 20% of 41.64 m2 (L32). Structural edits beyond that are rejected. Confirm this is intended as a save gate.
4. HMR side effects: writing `data/` triggers Vite's watcher, and `src/` imports the JSON. The editor state may be reloaded or lost on save. Not verified; test in an implementation spike.
5. Line endings: preserve the existing EOL (see Atomic write).
6. Node: `validate.mjs` needs Node 22.18+ locally and on Vercel. The Vercel Node version is not visible in this repo.
7. Vite version: 7.3.8 is pinned. 8.3.8 exists and was not evaluated.

## Not verified

- `ssrLoadModule` handling of JSON import attributes through the validator's import chain.
- `vite preview` and Vercel responses to a `*/*` GET of an unknown path (inferred from Vite's dev fallback code).
- HMR behavior when the JSON file changes under the editor.
- Vite 8 behavior of any of the APIs above.
- The Windows rename retry needed in practice (only libuv's flag was checked).
