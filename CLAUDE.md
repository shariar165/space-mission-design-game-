# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

This is **Signal Delay** (formerly Mission Drafting Table), a NASA space-mission game: a pure TypeScript simulation engine (`src/engine`) and a React + Vite UI (`src/ui`). The science rules live in `docs/SCIENCE_SPEC.md`, which is the source of truth for every equation, constant and rule (and, under "UI rules", for what the screens may show). Read the relevant section before changing a module.

## Toolchain: everything lives in `.venv`

Node 22.16.0 is installed **inside the Python venv** by `nodeenv`. The user wants every extra requirement installed through the venv, never globally (no `npm -g`, no system Node): npm packages go into the project `node_modules` using the venv's npm, Python tools via `.venv\Scripts\python -m pip`, pinned in `requirements.txt`. Put `.venv\Scripts` first on PATH before running npm/npx:

```powershell
.\.venv\Scripts\Activate.ps1          # PowerShell; or: $env:PATH = "$PWD\.venv\Scripts;$env:PATH"
```
```bash
export PATH="$PWD/.venv/Scripts:$PATH"  # Git Bash
```

Playwright (`@playwright/test`, a devDependency) keeps its browsers inside the venv: `playwright.config.ts` sets `PLAYWRIGHT_BROWSERS_PATH=.venv/ms-playwright`. To install them: `PLAYWRIGHT_BROWSERS_PATH=.venv/ms-playwright npx playwright install chromium`.

## Commands

| Task | Command |
| --- | --- |
| Dev server (the game) | `npm run dev` → http://localhost:5173 |
| Production build | `npm run build` (typecheck + `vite build` into `dist/`) |
| All tests | `npm test` (`vitest run`; includes the jsdom component tests in `tests/ui/`) |
| Component tests only | `npx vitest run tests/ui` |
| One file | `npx vitest run tests/physics.test.ts` |
| One test by name | `npx vitest run tests/physics.test.ts -t "Lambert"` |
| Validation only (rewrites `docs/VALIDATION_RESULTS.md`) | `npm run test:validation` |
| Data audit (rewrites `TODO_DATA.md`) | `npm run todo-data` |
| Typecheck | `npm run typecheck` (`tsc --noEmit`, TypeScript 7, strict, `noUncheckedIndexedAccess`) |
| Screenshots | `npm run shots` (Playwright: game and design copies at 1440 × 900 and 390 × 844; `-- fly`, `-- pack`, `-- report`, `-- design`). App shots go to `test-results/shots/`, design shots to `docs/design/signal-delay/shots/` |

There is no lint step.

**Deploy:** every push to `main` runs `.github/workflows/pages.yml` (npm ci, npm test, a build with `VITE_BASE=/<repo>/`) and publishes `dist/` to GitHub Pages: https://shariar165.github.io/space-mission-design-game-/ . Locally `base` stays `/`; in Git Bash set `MSYS_NO_PATHCONV=1` when you try a base path, or the path gets mangled.

**Generated files:** `docs/VALIDATION_RESULTS.md` and `TODO_DATA.md` are written by the tests' `afterAll` hooks. Never edit them by hand; change the data or code and rerun.

## Non-negotiable rules (from the spec and the user)

- **Every constant and data value is a `Sourced<T>`** (`src/engine/types.ts`), with `value`, `unit`, `source`, optional `url`, and `isGameEstimate`. `tests/dataAudit.test.ts` fails if any number in `src/data/*.json` is not wrapped. When you add engine-level constants, register them in that test's `ENGINE_VALUES`.
- **Values that are game estimates, or that the spec marks "approx." / "to verify",** keep the spec's value but get `isGameEstimate: true`. They then appear automatically in `TODO_DATA.md`. Never present an estimate as NASA data.
- **Validation:** when a `tests/validation.test.ts` check fails, fix the model or the data, **never the expected value**. Validation rows are labelled `validation` (independent published value), `calibration` (a constant was fitted to this value, e.g. MAVEN power → η_sys = 0.20) or `info`.
- **Tests first:** write `tests/physics.test.ts` cases before the code. Hand calculations go in comments next to each assertion.
- **One model for everyone:** real missions (`src/data/missions.json`) go through exactly the same `evaluateDesign` as player designs. `src/engine/missions.ts` turns a Sourced preset into a plain `Design`.

## UI rules (spec: "UI rules", rules 21–27 for Signal Delay)

- **The UI never computes a number.** It calls the engine and only formats units (`src/ui/format.ts`). Need a new on-screen number? Add it to the engine (with a test in `tests/engineApi.test.ts`, `tests/fly.test.ts`, `tests/pack.test.ts` or `tests/report.test.ts`), not the UI. `tests/uiGuards.test.ts` fails on digits in JSX text or "number + unit" in UI strings, and on any React/DOM import in `src/engine`. Put styles in CSS files, not inline strings.
- **Design source of truth:** the Claude Design "Signal Delay" screens, copied byte-for-byte in `docs/design/signal-delay/` (with reference shots). Tokens are CSS variables in `src/ui/styles/theme.css`; each screen has its own `sd-*.css`. After a visual change, run `npm run shots` and compare the app and design PNGs side by side.
  - **Fonts deliberately differ from the mockups** (the user asked for a game look): Orbitron (`--sd-display`), Exo 2 (`--sd-body`), Share Tech Mono (`--sd-mono`), VT323 on the CRT screens. Orbitron is about a third wider than the mockups' Big Shoulders, so display sizes were scaled by 0.75; check new display text at both shot sizes.
- **Navigation:** every step has ◂ BACK (`components/sd/BackButton.tsx`). `App.tsx` keeps a trail of visited steps (`go` / `back`), synced with the browser's Back button. Back skips a finished flight; Back in flight asks first (leave, finish, or keep flying).
- **Help for new players:** `MissionBriefing` (opens itself the first time a level is packed; MISSION INFO / ⓘ reopens it), `CoachCard` (how to fly: first flight, the ? key, HOW TO PLAY on Home), and the Pack launch checklist. Words live in `sdWords.ts` (`BRIEFING`, `COACH`, `LAUNCH_CHECKS`, `NAV`); "seen" flags in `saves.ts` (`sd.seen`). The screenshot specs pre-set `sd.seen`; `tests/visual/help.spec.ts` shoots the help itself.
- **One flight model everywhere (the Mission operations engine).**
  - Cadet: `Home` → (mission map) → `Pack` → `FlyAndSurvive` → `MissionReport`; `Daily` (share card) and `Notebook` from Home.
  - Engineer: `BuildBay` → `FlyAndSurvive` (Engineer readouts and the EQUATIONS drawer) → `MissionReport` with Engineer details.
  - The old crisis-card flight is gone from the UI (`simulateMission` / `previewCrisis` stay for engine and validation tests).
- Engineer mode shows each equation and every input; ⓘ (`SourceInfo`) shows the `Sourced<T>` record, with a "game estimate" badge when `isGameEstimate`.
- **Fly & Survive** (`screens/FlyAndSurvive.tsx`, `components/fly/*`):
  - Clock in `useOpsSession.ts` (`advanceOperations`, `decide`, `sendCommand`, `bookDsn`, `nextEventT`; a transit plays the team's reaction, the light-time trip, then the wait for the outcome).
  - **The chosen speed stays set** (II / 10× / 100× / 1000× mission days a minute): a card, a result, the eclipse card or an overlay only *holds* the clock (`locked` / `setHold`), and time runs on by itself once it clears. A transit that cannot advance is cleared (stall guard).
  - **FINISH MISSION** (`finish()` → engine `finishOperations`): the robot flies the rest with its default responses and ends at the extension decision, so every flight reaches the report. The footer shows `missionProgress` (bar + "MISSION ENDS IN …").
  - Numbers come from `consoleView`, `powerPlanPreview`, `dsnOptions` (`ops/console.ts`) and `flyTiles`, `flyCard`, `comingUp`, `eclipseCard`, `outcomeIn_s` (`ops/fly.ts`).
  - **Risk chips read "⚠ +n risk" (`riskIncrease`), never a negative number.**
  - The console panels (`components/ops/PowerDial`, `BookCall`, `OpsPanels`) are drawers.
- **Pack** (`screens/Pack.tsx`): numbers from `pack.ts` (`buildPackDesign`, `packBlockers`, `dangerDeck`, `calendarTransfers`, `dayQuality`, `fitPart`) and `evaluateDesign` / `cadetGauges`. Part data and effects live in `src/data/pack.json`; a part's effect reaches the engine through `Design.kit`. Volume (the nose) and weight (the launch meter) are separate limits, and each blocker names the one that failed. Levels carry their shelf (`levels.ts` `shelfOf`).
- **Mission Report** (`screens/MissionReport.tsx`, `components/report/ComicArt.tsx`): `operationsDebrief`, `reportPanels`, `reportVerdict` and `reportCompare` (`ops/report.ts`), star rules from `STAR_RULES`, and risk from `useOpsRisk`.
- **Home / Daily / Notebook** (`screens/Home.tsx`, `Daily.tsx`, `Notebook.tsx`): counts from `notebook.ts` (`notebook`, `notebookProgress`, `rescueProgress`, `flightFacts`, `newLessons`) and `daily.ts` (`dailyNumber`, `dailySeed`, `dailyDesign`, `dailyGrid`, `dailyStreak`, `nextDailyIn_s`). Lessons live in `src/data/notebook.json` and each points at an existing Sourced text. Notebook facts and Daily results are saved in the browser (`src/ui/saves.ts`).
- Words live in `src/ui/sdWords.ts` (Signal Delay), with `opsWords.ts` for the drawers. Pixel layout lives in `src/ui/sdGeometry.ts`. Levels and saved stars are in `src/ui/levels.ts`. New display constants go in `FLY_RULES` / `CONSOLE_RULES` / `pack.json`, registered in the data audit.
- **Component tests** (`tests/ui/*.test.tsx`) start with `// @vitest-environment jsdom` and import `./setup` (cleanup, empty storage, `openMarsLevel`). With fake timers, advance time in small slices: each animation step schedules the next.
- English only for now; the language toggle is hidden.

## Architecture

**Data flow.** `src/data/*.json` (Sourced values) → `src/engine/data.ts` (typed casts plus `lookup()`) → physics modules → `src/engine/index.ts` (and `compare.ts`), which the UI calls.

**Signal Delay engine modules:** `pack.ts` (Pack: nose, part effects, danger deck, launch calendar), `ops/fly.ts` (Fly & Survive view model), `ops/report.ts` (Mission Report), `notebook.ts` (Engineer's Notebook) and `daily.ts` (Daily mission).

**`index.ts`** has four main entry points (`previewCrisis` shows the crisis card a seed will draw, before `simulateMission` flies it):
- `evaluateDesign(design)` runs the whole pipeline:
  1. Trajectory: Lambert between the design's dates, a fixed route, or an Earth-centred transfer for the Moon.
  2. Power on every day of the prime mission, eclipses included (`powerProfile.ts`, shared with Ops); the Power meter is the worst day.
  3. Batteries sized for the worst-case eclipse at the heaviest science load, within a 30% depth of discharge.
  4. Mass: the concept roll-up with 30% growth, or `asFlownDryMass_kg` for real missions.
  5. Δv budget against rocket-equation capability.
  6. Launch capacity read off the payload(C3) curve, or the secondary slot on a rideshare (`rideshares.json`).
  7. Comms, cost, and phase risks (the single-card flight's model only).

  It returns five `Meter`s (no Risk: that one is the Ops Monte Carlo in `ops/riskEstimate.ts`, run by the UI in a Web Worker via `src/ui/riskRunner.ts`) (`used / limit / margin / status / equation / inputs`), plain-language `blockers`, non-blocking `notes`, and `details` (the numbers the simulation and Debrief need).
- `simulateMission(design, {seed, rng, crisisPolicy})` flies one mission:
  - It draws one crisis card, whose day falls inside its phase.
  - It offers only the options the spare margins can pay for.
  - It rolls each phase, downlinks science day by day using the ephemeris distance, then scores the mission, awards stars and builds the next-star hint.
- `monteCarloMission` runs `simulateMission` many times (default 1,000) from one seeded generator.

**Mission operations (`src/engine/ops/`; spec "Mission operations"; UI: the Operations Console).**
- Entry points in `ops/index.ts`:
  - `startOperations`, `advanceOperations` (stops at each new decision), `sendCommand`, `decide`, `bookDsn`;
  - `runOperations` (headless, with a policy), `finishOperations` (fly on from any state to the end; `runOperations` uses it), `replayOperations` (seed + action log);
  - `operationsDebrief`, `operationsForecast`.
- `timeline.ts` `prepareOps(design)` precomputes the fixed day-by-day environment: distances, light time, Sun–Earth–probe angle, eclipses, power, link rates and dose. The clock then runs in days, split part-way through a day when a command arrives.
- **Determinism:** each hazard has its own seeded stream (`subRng`), and every random number is drawn at the start (Poisson thinning). Tests rely on the same seed giving the same mission, and on decisions never reshuffling later draws. `rng: () => 0.999999` means no bad luck.
- **Separate from the prime score:** in Ops the hazards replace the generic cruise and science base rates. The extension is reported separately and never changes the prime score.
- Data: `operations.json` (parameters) and `hazards.json` (hazards, responses, real history marked "to verify").

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
- The comms link is anchored to MRO's published design point (DESCANSO Article 12), and the DSN gains come from 810-005. But the ground station behind MRO's 500 kbps figure is inferred (34 m), so the Data meter and the Debrief downlink still show a "rests on an estimate" badge.

See `TODO_DATA.md` and the README's "Known model limits".
