# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

This is **Mission Drafting Table**, a NASA space-mission design game: a pure TypeScript simulation engine (`src/engine`) and a React + Vite UI (`src/ui`). The science rules live in `docs/SCIENCE_SPEC.md`, which is the source of truth for every equation, constant and rule (and, under "UI rules", for what the screens may show). Read the relevant section before changing a module.

## Toolchain: everything lives in `.venv`

Node 22.16.0 is installed **inside the Python venv** by `nodeenv`. The user wants every extra requirement installed through the venv, never globally (no `npm -g`, no system Node): npm packages go into the project `node_modules` using the venv's npm, Python tools via `.venv\Scripts\python -m pip`, pinned in `requirements.txt`. Put `.venv\Scripts` first on PATH before running npm/npx:

```powershell
.\.venv\Scripts\Activate.ps1          # PowerShell; or: $env:PATH = "$PWD\.venv\Scripts;$env:PATH"
```
```bash
export PATH="$PWD/.venv/Scripts:$PATH"  # Git Bash
```

## Commands

| Task | Command |
| --- | --- |
| Dev server (the game) | `npm run dev` → http://localhost:5173 |
| Production build | `npm run build` (typecheck + `vite build` into `dist/`) |
| All tests | `npm test` (`vitest run`) |
| One file | `npx vitest run tests/physics.test.ts` |
| One test by name | `npx vitest run tests/physics.test.ts -t "Lambert"` |
| Validation only (rewrites `docs/VALIDATION_RESULTS.md`) | `npm run test:validation` |
| Data audit (rewrites `TODO_DATA.md`) | `npm run todo-data` |
| Typecheck | `npm run typecheck` (`tsc --noEmit`, TypeScript 7, strict, `noUncheckedIndexedAccess`) |

There is no lint step.

**Generated files:** `docs/VALIDATION_RESULTS.md` and `TODO_DATA.md` are written by the tests' `afterAll` hooks. Never edit them by hand; change the data or code and rerun.

## Non-negotiable rules (from the spec and the user)

- **Every constant and data value is a `Sourced<T>`** (`src/engine/types.ts`), with `value`, `unit`, `source`, optional `url`, and `isGameEstimate`. `tests/dataAudit.test.ts` fails if any number in `src/data/*.json` is not wrapped. When you add engine-level constants, register them in that test's `ENGINE_VALUES`.
- **Values that are game estimates, or that the spec marks "approx." / "to verify",** keep the spec's value but get `isGameEstimate: true`. They then appear automatically in `TODO_DATA.md`. Never present an estimate as NASA data.
- **Validation:** when a `tests/validation.test.ts` check fails, fix the model or the data, **never the expected value**. Validation rows are labelled `validation` (independent published value), `calibration` (a constant was fitted to this value, e.g. MAVEN power → η_sys = 0.20) or `info`.
- **Tests first:** write `tests/physics.test.ts` cases before the code. Hand calculations go in comments next to each assertion.
- **One model for everyone:** real missions (`src/data/missions.json`) go through exactly the same `evaluateDesign` as player designs. `src/engine/missions.ts` turns a Sourced preset into a plain `Design`.

## UI rules (spec: "UI rules")

- **The UI never computes a number.** It calls the engine and only formats units (`src/ui/format.ts`). Need a new on-screen number? Add it to the engine (with a test in `tests/engineApi.test.ts`), not the UI. `tests/uiGuards.test.ts` fails on digits in JSX text or "number + unit" in UI strings, and on any React/DOM import in `src/engine`.
- Engineer mode shows each `Meter.equation` and every `Meter.inputs` entry; ⓘ (`SourceInfo`) shows the `Sourced<T>` record, with a "game estimate" badge when `isGameEstimate`.
- UI entry points: `evaluateDesign`, `previewCrisis` + `simulateMission` (crisis card → Debrief), `monteCarloMission`, `designDelta` and `compareWithRealMission` (`compare.ts`), `bestLaunchWindow` (starter dates).
- English only for now; the language toggle is hidden. Design references: `docs/design/`.

## Architecture

**Data flow.** `src/data/*.json` (Sourced values) → `src/engine/data.ts` (typed casts plus `lookup()`) → physics modules → `src/engine/index.ts` (and `compare.ts`), which the UI calls.

**`index.ts`** has four entry points (`previewCrisis` shows the crisis card a seed will draw, before `simulateMission` flies it):
- `evaluateDesign(design)` runs the whole pipeline:
  1. Trajectory: Lambert between the design's dates, a fixed route, or an Earth-centred transfer for the Moon.
  2. Power at the arrival date and at the end of science, from the ephemeris Sun distance.
  3. Batteries sized for the eclipse in the science orbit.
  4. Mass: the concept roll-up with 30% growth, or `asFlownDryMass_kg` for real missions.
  5. Δv budget against rocket-equation capability.
  6. Launch capacity read off the payload(C3) curve.
  7. Comms, cost, and phase risks.

  It returns six `Meter`s (`used / limit / margin / status / equation / inputs`), plain-language `blockers`, non-blocking `notes`, and `details` (the numbers the simulation and Debrief need).
- `simulateMission(design, {seed, rng, crisisPolicy})` flies one mission:
  - It draws one crisis card, whose day falls inside its phase.
  - It offers only the options the spare margins can pay for.
  - It rolls each phase, downlinks science day by day using the ephemeris distance, then scores the mission, awards stars and builds the next-star hint.
- `monteCarloMission` runs `simulateMission` many times (default 1,000) from one seeded generator.

**Module responsibilities that span files:**
- **Margins → risk → score.** `meter.ts` sets status: below 0 is over, below 10% is a warning.
  - `risk.ts` turns margins into phase failure factors: f = 1 at ≥10%, 3 at 0%, ∞ below 0.
  - `scoring.ts` scores margins on the 10–30% band (zero at 0% and at 80%). So one margin affects several outputs at once.
- **Δv budget** (`propulsion.ts` `deltaVBudget`) is the sum of:
  - the arrival burn (capture equation; for Bennu, v∞)
  - the capture → science orbit change (`trajectory.ts` `orbitChangeDeltaV`, vis-viva)
  - 50 m/s for trajectory corrections
  - maintenance over the science days
  - the lifetime reserve, for `lifetimeDays` beyond the science days
  - extra fixed-route Δv
- **Trajectory limits.** The Lambert solver handles zero-revolution transfers only.
  - `maxFlightDays(dest)` = 2 × Hohmann time. Longer direct flights become a blocker, and `bestArrival` never searches past it.
  - Gravity assists are never simulated. Bennu's `trajectoryOption: 'nasa-earth-flyby'` is a fixed, labelled route (`destinations.json` → `fixedRoutes`): it uses the published C3 and computes only the post-flyby leg by Lambert.
- **Ephemeris.** `ephemeris.ts` uses the JPL approximate Keplerian elements (Table 1, valid 1800–2050) from `orbitalElements.json`. Bennu uses JPL SBDB osculating elements. The Moon is Earth-centred and sits at Earth's heliocentric position.

## Units and conventions

- The engine works in SI internally: m, s, kg, W, and μ in m³/s². JSON keeps the units things were published in, and the unit goes in the field name (`_km`, `_1e6km`, `gm_km3s2`). Convert with the helpers in `constants.ts` (`km()`, `mu()`, `days()`, `toDays()`, `AU_M`, `MU_SUN_SI`).
- C3 is reported in km²/s². `Evaluation.trajectory.vInfArr` is in km/s; `*_ms` fields are m/s.
- `captureOrbit` and `scienceOrbit` periapsis/apoapsis are **altitudes** above the equatorial radius, not radii.
- Score = Σ wᵢsᵢ on a 0–100 scale. The spec's `100 Σ wᵢsᵢ` was interpreted this way; see the README.

## Known data gaps

These show up as validation caveats:
- The Atlas V payload-vs-C3 curves in `launchVehicles.json` are **placeholders**. NASA's LSP site can't be scraped, so a person must export the points. Launch-capacity validation rows are therefore not real evidence.
- The comms reference link is a placeholder, so the Data meter reports `calibrated: false`.

See `TODO_DATA.md` and the README's "Known model limits".
