# Apartment Three.js

- Architectural values and provenance belong in `data/measurements.json`; keep shared geometry coherent. Owner feedback and visual estimates must not become drawing-verified dimensions.
- Use `npm run apartment -- --help` for the app's agent/CI CLI. Prefer `inspect`, `view`, `layer`, `camera` and `screenshot`; use `browser` for raw agent-browser commands.
- Before browser automation, read `npx agent-browser skills get core`. Use the CLI's worktree session, or pass the same explicit `--session` on every interactive command. Finish with `close`.
- Use `node scripts/apartment.mjs ...` for JSON-only output. Read state after actions; capture screenshots for the canvas. `inspect` includes actual WebGL render/camera health.
- Validate with `npm run test:cli`, `npm run validate`, `npm run build`, then `npm run apartment -- test` (requires `npx agent-browser install` once). CI uses the same smoke command.
- Inspect `test-results/browser/report.json` and its PNGs. A blocked browser launch is a failed/unverified browser run, never a passing test. Keep infrastructure minimal; there is no backend.
- Every change to `src/` or `scripts/` gets a CUPID check before finishing: run the `cupid` skill (`.claude/skills/cupid/SKILL.md`). A project Stop hook enforces this once per distinct diff.
