# Signal Delay

**[▶ Play now](https://shariar165.github.io/space-mission-design-game-/)** · runs in the browser, no install

*You don't fly the rocket. You keep a robot alive millions of kilometres away, and every order arrives minutes late.*

A NASA space-mission design game: a pure TypeScript simulation engine (`src/engine`) and a React + Vite UI (`src/ui`) in a retro mission-control look (design: the Claude Design "Signal Delay" screens, copied in `docs/design/signal-delay/`). **Cadet mode** (the default): pick a mission, **Pack** the rocket nose (volume and weight are separate limits) for the dangers you can see coming, pick a launch day, then **Fly & Survive**: danger cards stop time, you choose, and the order crawls to the robot at light speed. The **Mission Report** prints the flight as a comic and hands you a real lesson for the **Engineer's Notebook**. A **Daily mission** is the same flight for everyone each day, with a spoiler-free share card. **Engineer mode** builds in the full Build Bay and flies the same Fly & Survive with every equation and source. One flight model everywhere: the Mission operations engine. The UI only displays numbers the engine computes. The science rules are in [docs/SCIENCE_SPEC.md](docs/SCIENCE_SPEC.md). Every constant and data value is a `Sourced<T>` that carries its source and an `isGameEstimate` flag.

## Setup (everything lives in `.venv`)

Node is installed inside the Python virtual environment with [nodeenv](https://github.com/ekalinin/nodeenv), so nothing is installed globally.

```powershell
python -m venv .venv                       # already done
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\nodeenv -p --node=22.16.0  # already done: puts node/npm into .venv\Scripts
.\.venv\Scripts\Activate.ps1               # puts .venv\Scripts (node, npm) first on PATH
npm install
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the game at http://localhost:5173 (Vite dev server) |
| `npm run build` | Typecheck, then build the static site into `dist/` |
| `npm test` | All tests: physics, validation, data audit, engine API, UI guards, and the component tests in `tests/ui/` (jsdom + Testing Library) |
| `npx vitest run tests/ui` | Component tests only |
| `npm run test:validation` | Real-mission validation only; writes `docs/VALIDATION_RESULTS.md` |
| `npm run todo-data` | Data audit; regenerates `TODO_DATA.md` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run shots` | Playwright screenshots of the game and the design copies at 1440 × 900 and 390 × 844 (browsers live in `.venv/ms-playwright`) |

## Layout

```
src/engine/
  types.ts        Sourced<T>, Design, Meter, Evaluation
  constants.ts    constants and game rules (each Sourced), SI helpers
  ephemeris.ts    JPL approximate planet positions (1800–2050); Bennu from JPL SBDB
  trajectory.ts   Hohmann, phase angle, Lambert (universal variables), capture Δv, Moon (Earth-centred)
  propulsion.ts   rocket equation, propellant needed, tanks, Δv budget
  launch.ts       payload(C3) interpolation, mass margin, Laplace reliability
  power.ts        solar 1/r² with η_sys = 0.20 (MAVEN), RTG, heaters, eclipse, batteries
  comms.ts        scaled link budget (uncalibrated placeholder anchor), light delay
  massCost.ts     mass roll-up with 30% growth, development cost vs class cap
  risk.ts         phase risk p_base·Π f(margin), Laplace launch risk, Risk meter, seeded Monte Carlo
  crisis.ts       crisis cards, mission timeline, draw (day inside its phase), options vs margins
  scoring.ts      weights, margin bands, budget/science/success scores, stars, next-star hint
  missions.ts     MAVEN / OSIRIS-REx presets → Design
  index.ts        evaluateDesign(), simulateMission(), monteCarloMission(), previewCrisis()
  compare.ts      designDelta() for part cards, compareWithRealMission() for the Debrief
  designEdits.ts  pure edits to a Design (withArrayArea, withPropellant, …), shared by the UI and cadet.ts
  cadet.ts        Cadet guided build: sizing by bisection, 2–3 cards per step, chips, gauges, testFlight()
  flightMap.ts    craft position, signal delay and countdown, flight frames, map geometry, ghostFor()
  rescue.ts       Rescue History cases (Mars Climate Orbiter), clues, consequence, stars
  ops/            Mission operations: day-by-day clock, hazards, commands with light delay, DSN, extension;
                  console.ts is the Operations Console view model (consoleView, powerPlanPreview, dsnOptions)
  pack.ts         Signal Delay Pack: nose grid, part effects (Design.kit), danger deck, launch calendar
  ops/fly.ts      Fly & Survive view model: five-segment tiles, danger-card times and chips, Coming Up ribbon
  ops/report.ts   Mission Report: comic panels, what saved / hurt you, you vs the real mission
  notebook.ts     Engineer's Notebook: lessons that point at existing Sourced texts, unlock rules
  daily.ts        Daily mission: date seed, number, fixed craft, outcome grid, streak
src/ui/           React UI: App.tsx, screens/ (Home, Pack, FlyAndSurvive, MissionReport, Daily, Notebook;
                  Engineer BuildBay; LevelMap, Rescue), saves.ts (notebook facts and daily results in the browser), components/sd (icons, teletype, lever), components/fly, components/report,
                  components/ops (console drawers), levels.ts (levels, shelves and saved stars),
                  sdWords.ts (Signal Delay wording), sdGeometry.ts (pixel layout), useOpsSession.ts (clock),
                  format.ts (unit display only), styles/theme.css (design tokens) + sd-*.css per screen
src/data/         destinations, orbitalElements, launchVehicles, parts, missions, crisisCards, lessons,
                  rescueCases, pack, notebook (all values Sourced)
tests/            physics.test.ts, validation.test.ts, dataAudit.test.ts, engineApi.test.ts, uiGuards.test.ts,
                  ui/*.test.tsx (component tests)
docs/design/      reference copies of the Claude Design mockups (signal-delay/ is the current UI)
tests/visual/     Playwright screenshot harness (npm run shots), not part of npm test
```

All modules in the spec's build order are built.

- **Cadet:** Home → Pack (PLAY, or choose a mission on the map) (parts shelf, rocket nose, weight scale, danger deck, launch calendar, ARM, LAUNCH) → Fly & Survive → Mission Report with the level stars and any new Notebook lesson. Daily mission, Rescue History and the Notebook open from Home.
- **Engineer:** Build Bay → Fly & Survive (Engineer readouts and the EQUATIONS drawer) → Mission Report with the score breakdown, every comparison row's ⓘ and the Mission operations risk.
- **Fly & Survive (both modes, spec UI rules 16–20):** the Mission operations engine flies the craft day by day: danger cards with light-delayed orders, the eclipse planning card, the power plan, calls home on the 34 m or 70 m dish, conjunction blackouts, safe mode and the extension decision.

## Additions to the spec interfaces

- `Design.asFlownDryMass_kg`: real-mission presets use their published, as-built dry mass. The 30% concept growth margin is not added on top.
- `Design.missionClass` (default `discovery`) and `Design.scienceDays` (default 365).
- `Design.scienceOrbit` (altitudes): the craft pays a vis-viva two-burn transfer from the capture orbit. Batteries are sized for the eclipse in this orbit.
- `Design.lifetimeDays`: the mission-lifetime Δv reserve is the maintenance rate × (lifetime − science days).
- `Design.trajectoryOption`: `'direct'` (Lambert between the dates) or `'nasa-earth-flyby'` for Bennu. That option is the published OSIRIS-REx route: launch C3 = 29.29678 km²/s², the flyby is not simulated, only the post-flyby leg is computed, and the deep-space manoeuvre is charged as spacecraft Δv.
- `captureOrbit.periapsis_km` / `apoapsis_km` are **altitudes** above the equatorial radius.
- `Evaluation.notes`: non-blocking messages, such as "flybys are not modelled". `Evaluation.details` holds the computed numbers the Debrief and validation need.
- `Meter.calibrated`: `false` on the Data meter until a real reference link is chosen.
- `meters.risk` is the mission failure probability vs an acceptable-risk limit (game value).
- `Design.kit` (Signal Delay Pack only): a battery factor, extra dry mass, per-hazard failure-chance factors, a cold factor for heaters and the autopilot flag. Real missions carry none, so every factor defaults to 1.
- `Design.scienceOrbit.inclination_deg` / `raan_deg` / `argPeriapsis_deg` (optional, degrees from the planet's IAU equator): Mission operations uses them for eclipse seasons and the Jupiter dose. Defaults (polar) come from `operations.json`; MAVEN's preset has its published 75°.

## Known model limits (beyond the spec's Assumptions list)

- The Lambert solver is zero-revolution only. Direct player transfers are capped at less than one revolution of the Hohmann transfer orbit (2 × t_Hohmann: 518 days to Mars, 399 to Bennu). Longer flights are blocked with a plain-language message. Real routes with flybys are offered only as fixed, labelled options.
- Scoring: the spec writes `Score = 100 Σ wᵢ sᵢ` with sᵢ ∈ [0, 100], which would reach 10,000. The engine uses `Σ wᵢ sᵢ` (0–100).
- In the simulation, a crisis option's bad outcome ends the phase that option affects. Crisis costs (Δv, science days, budget) are applied only if the crisis is reached; a test bought before launch is always paid.
- Bennu is propagated two-body from its 2011 osculating elements, with no planetary perturbations.
- The Earth position is the Earth–Moon barycentre (JPL table), and UTC is used for TDB (about 69 s off).
- Flight map and light delay: in cruise the craft is placed along the time-sampled Lambert path (Moon: Kepler's equation on the transfer half-ellipse). The fixed Bennu route and the trip home are approximate (drawing and light delay only; the return transfer is not modelled).
- The ghost of a real mission is its preset path turned about the Sun to start beside the player (it flew in another year). The rotation keeps its shape and Sun distances.
- Mission operations (`src/engine/ops/`, no UI yet):
  - the science orbit is fixed in inertial space (no J2 precession);
  - cruise positions for the Sun–Earth–probe angle lie in the ecliptic plane;
  - the Moon has no conjunctions (there is no lunar ephemeris);
  - DSN fees are FY09 dollars against FY2019 caps.
  - The Power meter and Ops read the same day-by-day power (eclipses included), so a design the meter calls fine has enough power on every planned day. Ops can still shed loads after hazards or a player's power plan.
  - Most hazard rates, response costs and failure chances are game estimates (`TODO_DATA.md`).
- At the Moon a whole Atlas V 401 lifts about 4,600 kg (placeholder curve), so a Cadet craft's mass margin is 82–87%. The sourced LRO/LCROSS rideshare (1000 kg secondary slot) brings it to 16–41%, so the third star is reachable on a shared ride (radar kit, safe fuel). Moon-1 and Moon-2 do not open both the science and the rocket step, so their third star stays out of reach.
- The Risk meter is a 500-run seeded Monte Carlo of Mission operations. Its standard error (about ±1 point for MAVEN) is shown. The Cadet Flight and the Engineer crisis card still fly the single-card phase-risk model.
- Batteries are sized for the analytic worst-case eclipse within a 30% depth of discharge (game estimate). The default Jupiter orbit's 34-hour worst-case eclipse needs a very heavy battery, even though the inertially fixed orbit never actually enters an eclipse season.
