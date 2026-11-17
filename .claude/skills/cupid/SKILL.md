---
name: cupid
description: Check a change in this repo against the CUPID properties (Composable, Unix philosophy, Predictable, Idiomatic, Domain-based) and fix what it finds. Use before finishing any change to src/ or scripts/, when the CUPID stop hook asks for it, or for "/cupid" or "is this CUPID".
---

# CUPID check

CUPID (https://cupid.dev) describes *properties* that code has more or less of, not rules to pass or fail.
Use this check to move a change toward them, without speculative abstraction.

## Process

1. Look at the change: `git diff HEAD` plus any untracked files under `src/` and `scripts/`.
2. Go through the five properties below, but only for the code the change touches or relies on.
3. Fix real friction now, keeping each fix small and keeping the existing structure.
   If a gap is pre-existing or out of scope, report it instead.
4. Rerun the gates listed in AGENTS.md.
5. Report one line per property: `ok`, `fixed: …` or `noted: …`.

## Properties and how they look here

**Composable** - small surface, easy to use in other contexts, few dependencies.
- Pure logic lives in plain TS modules that node tests import directly: `apartment-model.ts`, `walk-motion.ts`, `view-mode.ts`.
  React and three.js only read their results.
- A new concept gets a module with a narrow interface, not new props threaded through `App`.

**Unix philosophy** - each module does one thing well.
- `ApartmentScene` draws, `CameraRig` places cameras, `Sidebar` is UI chrome, and `viewMachine` owns view transitions.
- Don't add a second job to one of these.
- If a component starts to need listeners, state and rendering all at once, split it.

**Predictable** - it behaves as expected, is deterministic, and its internals can be observed.
- Each value is defined once: poses (`OVERVIEW_POSE`, `PLAN_POSE`, `WALK_START`, `EYE_HEIGHT`) and dimensions in `data/measurements.json`.
- No repeated magic numbers.
- State transitions go through `viewMachine`. Don't hide state in refs or handlers.
- Fail loudly on bad input, the way `apartment.point` and `apartment.room` do.
- The automation bridge exposes generic observations (`getState`, `find`), not fields made for one test.

**Idiomatic** - it reads like the rest of the codebase.
- Write readable TSX with named components and lines of normal length.
- Use the existing helpers before adding new ones: `apartment.wallRuns`, `wallAxis`, `soffitBox`, `polygonContains`.
- Tests use `node:test` under `scripts/*.test.mjs`, and AGENTS.md lists the gates.

**Domain-based** - the code uses the domain's language and structure.
- Use the terms in `GLOSSARY.md`: Apartment model, wall run, soffit box, view mode.
- Name new code after architectural concepts (opening, soffit, room), not generic ones (piece, item, data2).
- Add new domain terms to `GLOSSARY.md`.
- Treat owner estimates as estimates (`status: "estimated"`). Never present them as verified dimensions.

## Don't
- Don't invent abstractions for hypothetical needs. One adapter is a hypothetical seam.
- Don't reformat or refactor code the change doesn't touch.
- Don't treat CUPID as a reason to skip AGENTS.md gates or the browser run.
