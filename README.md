# Mission Drafting Table

A NASA space-mission design game: a pure TypeScript simulation engine (`src/engine`) and a React + Vite UI (`src/ui`) with the Build Bay and Debrief screens. The UI only displays numbers the engine computes. The science rules are in [docs/SCIENCE_SPEC.md](docs/SCIENCE_SPEC.md). Every constant and data value is a `Sourced<T>` that carries its source and an `isGameEstimate` flag.

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
| `npm test` | All tests: physics, validation, data audit, engine API, UI guards |
| `npm run test:validation` | Real-mission validation only; writes `docs/VALIDATION_RESULTS.md` |
| `npm run todo-data` | Data audit; regenerates `TODO_DATA.md` |
| `npm run typecheck` | `tsc --noEmit` |

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
src/ui/           React UI: App.tsx, screens/ (BuildBay, CrisisScreen, Debrief), components/,
                  format.ts (unit display only), meters.ts (meter wording), starters.ts (starter design inputs)
src/data/         destinations, orbitalElements, launchVehicles, parts, missions, crisisCards (all values Sourced)
tests/            physics.test.ts, validation.test.ts, dataAudit.test.ts, engineApi.test.ts, uiGuards.test.ts
docs/design/      reference copy of the Claude Design mockups
```

All modules in the spec's build order are built. The UI has Build Bay → one crisis card → Debrief; the Mission, Window and Flight screens come next.

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

## Known model limits (beyond the spec's Assumptions list)

- The Lambert solver is zero-revolution only. Direct player transfers are capped at less than one revolution of the Hohmann transfer orbit (2 × t_Hohmann: 518 days to Mars, 399 to Bennu). Longer flights are blocked with a plain-language message. Real routes with flybys are offered only as fixed, labelled options.
- Scoring: the spec writes `Score = 100 Σ wᵢ sᵢ` with sᵢ ∈ [0, 100], which would reach 10,000. The engine uses `Σ wᵢ sᵢ` (0–100).
- In the simulation, a crisis option's bad outcome ends the phase that option affects. Crisis costs (Δv, science days, budget) are applied only if the crisis is reached; a test bought before launch is always paid.
- Bennu is propagated two-body from its 2011 osculating elements, with no planetary perturbations.
- The Earth position is the Earth–Moon barycentre (JPL table), and UTC is used for TDB (about 69 s off).
