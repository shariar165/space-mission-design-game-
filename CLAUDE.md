# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

This is **Signal Delay** (formerly Mission Drafting Table), a NASA space-mission game: a pure TypeScript simulation engine (`src/engine`) and a React + Vite UI (`src/ui`). The science rules live in `docs/SCIENCE_SPEC.md`, which is the source of truth for every equation, constant and rule (and, under "UI rules", for what the screens may show). Read the relevant section before changing a module.

**Current state:** `docs/HANDOFF.md` records what is merged, the open items (delete the dead `OpsSummary`, a "Judge in 3 minutes" README section, the Atlas V LSP placeholder curves), known limitations and the working rules. Read it first in a new session and keep it current when an open item closes.

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
| Screenshots | `npm run shots` (Playwright: game and design copies at 1440 × 900 and 390 × 844; `-- fly`, `-- pack`, `-- report`, `-- design`). App shots go to `test-results/shots/`, design shots to `docs/design/signal-delay/shots/`. Specs live in `tests/visual/` and are not part of `npm test`; Playwright starts its own Vite on port 5199 (or reuses one already there) |
| DONKI snapshot (normally the Pages build does this) | `node scripts/fetch-donki.mjs` writes `public/data/donki-latest.json` (git-ignored: try the live Daily in `npm run dev`); `--fixtures 2024-05-08 2024-05-14` records raw responses into `tests/fixtures/donki/`. CCMC may be unreachable from your network; the script then exits 1 and writes nothing |

There is no lint step.

**CI:** every pull request to `main` runs `.github/workflows/ci.yml` (npm ci, `npm run typecheck`, `npm test`; no build, no deploy). Keep PRs green: the Pages deploy runs the same tests and stops on a failure.

**Deploy:** every push to `main` runs `.github/workflows/pages.yml` (npm ci, npm test, a build with `VITE_BASE=/<repo>/`) and publishes `dist/` to GitHub Pages: https://shariar165.github.io/space-mission-design-game-/ . `pages.yml` also runs daily at 00:20 UTC (GitHub may start it late): before the tests, it fetches NASA DONKI flares, CMEs and SEP events from the CCMC DONKI-API (`src/data/spaceWeather.json` `donki.apiBase`, no key) into `public/data/donki-latest.json`, which is published with the site and **never committed**; if CCMC is down it keeps the snapshot that is live now. Nothing pushes to `main`: it is protected and requires the "Typecheck and tests" check. `.github/workflows/donki.yml` (manual only) records DONKI fixtures on a new branch, opens a pull request and starts CI on it (a PR opened with the workflow token starts no workflows by itself). The game reads only the static snapshot and never calls CCMC. Locally `base` stays `/`; in Git Bash set `MSYS_NO_PATHCONV=1` when you try a base path, or the path gets mangled.

**Generated files:** `docs/VALIDATION_RESULTS.md` and `TODO_DATA.md` are written by the tests' `afterAll` hooks. Never edit them by hand; change the data or code and rerun.

## Non-negotiable rules (from the spec and the user)

- **Every constant and data value is a `Sourced<T>`** (`src/engine/types.ts`), with `value`, `unit`, `source`, optional `url`, and `isGameEstimate`. `tests/dataAudit.test.ts` fails if any number in `src/data/*.json` is not wrapped. When you add engine-level constants, register them in that test's `ENGINE_VALUES`.
- **Values that are game estimates, or that the spec marks "approx." / "to verify",** keep the spec's value but get `isGameEstimate: true`. They then appear automatically in `TODO_DATA.md`. Never present an estimate as NASA data.
- **Validation:** when a `tests/validation.test.ts` check fails, fix the model or the data, **never the expected value**. Validation rows are labelled `validation` (independent published value), `calibration` (a constant was fitted to this value, e.g. MAVEN power → η_sys = 0.20) or `info`.
- **Tests first:** write `tests/physics.test.ts` cases before the code. Hand calculations go in comments next to each assertion.
- **One model for everyone:** real missions (`src/data/missions.json`) go through exactly the same `evaluateDesign` as player designs. `src/engine/missions.ts` turns a Sourced preset into a plain `Design`.

## UI rules (spec: "UI rules", rules 21–27 for Signal Delay)

- **The UI never computes a number.** It calls the engine and only formats units (`src/ui/format.ts`). Need a new on-screen number? Add it to the engine (with a test in `tests/engineApi.test.ts`, `tests/fly.test.ts`, `tests/pack.test.ts`, `tests/report.test.ts` or `tests/notebook.test.ts` (Notebook and Daily)), not the UI. `tests/uiGuards.test.ts` fails on digits in JSX text or "number + unit" in UI strings, and on any React/DOM import in `src/engine`. Put styles in CSS files, not inline strings.
- **Design source of truth:** the Claude Design "Signal Delay" screens, copied byte-for-byte in `docs/design/signal-delay/` (with reference shots). Tokens are CSS variables in `src/ui/styles/theme.css`; each screen has its own `sd-*.css`. After a visual change, run `npm run shots` and compare the app and design PNGs side by side.
  - **Fonts deliberately differ from the mockups** (the user asked for a game look): Orbitron (`--sd-display`), Exo 2 (`--sd-body`), Share Tech Mono (`--sd-mono`), VT323 on the CRT screens. Orbitron is about a third wider than the mockups' Big Shoulders, so display sizes were scaled by 0.75; check new display text at both shot sizes.
- **Navigation:** every step has ◂ BACK (`components/sd/BackButton.tsx`). `App.tsx` keeps a trail of visited steps (`go` / `back`), synced with the browser's Back button. Back skips a finished flight; Back in flight asks first (leave, finish, or keep flying).
- **Cold open** (`screens/ColdOpen.tsx`, `sd-coldopen.css`; spec UI rule 47; App step `cold`): a new player's first launch (Cadet, no name, `sd.seen` has neither `name` nor `cold-open`) opens on a ▶ RECEIVE TRANSMISSION gate (the tap starts the sound; skipped under reduced motion with the sound muted), then Mars Climate Orbiter's arrival, told from `rescue.ts` `coldOpenFacts` with words `COLD_OPEN`, then Name Your Robot (`afterName` `home`), then Home. SKIP or Esc ends it; Home's INTRO replays it. Beat holds are `COLD_OPEN_HOLD_MS`; reduced motion holds each `COLD_OPEN_STILL_MS`. Tests `tests/ui/coldOpen.test.tsx`; shots `tests/visual/coldopen.spec.ts` (`npm run shots -- coldopen`). Specs that need a new player who skips it set `sd.seen` `['cold-open']`.
- **Name Your Robot** (`screens/NameRobot.tsx`, `sd-name.css`; spec UI rule 38): before the first Cadet mission or Daily, when the robot has no name and `sd.seen` has no `name`, `App.go` shows it first (`afterName`). SKIP keeps the default; the Pack `NameTag` renames later. Names are `cleanRobotName` (12 max), cleaned again on load. Component tests pre-set `sd.seen` `['name']` in `setup.ts`; `help.spec.ts` shoots the screen for a new player. The game's vision (spec "Vision") is the yardstick for new features.
- **Help for new players:** `MissionBriefing` (opens itself the first time a level is packed; MISSION INFO / ⓘ reopens it), `CoachCard` (how to fly: first flight, the ? key, HOW TO PLAY on Home), and the Pack launch checklist. Words live in `sdWords.ts` (`BRIEFING`, `COACH`, `LAUNCH_CHECKS`, `NAV`); "seen" flags in `saves.ts` (`sd.seen`). The screenshot specs pre-set `sd.seen`; `tests/visual/help.spec.ts` shoots the help itself.
- **One flight model everywhere (the Mission operations engine).**
  - Cadet: `Home` → (mission map) → (`NameRobot`, first time) → `Pack` (→ `LaunchDay` by CHANGE) → `FlyAndSurvive` → `MissionReport`; `Daily` (share card), `Notebook` and Rescue History (`screens/Rescue.tsx`, engine `rescue.ts`, data `rescueCases.json`) from Home.
  - Engineer: `BuildBay` → `FlyAndSurvive` (Engineer readouts and the EQUATIONS drawer) → `MissionReport` with Engineer details.
  - The old crisis-card flight is gone from the UI (`simulateMission` / `previewCrisis` stay for engine and validation tests).
- Engineer mode shows each equation and every input; ⓘ (`SourceInfo`) shows the `Sourced<T>` record, with a "game estimate" badge when `isGameEstimate`.
- **Fly & Survive** (`screens/FlyAndSurvive.tsx`, `components/fly/*`):
  - Clock in `useOpsSession.ts` (`advanceOperations`, `decide`, `sendCommand`, `bookDsn`, `nextEventT`; a transit plays the team's reaction, the light-time trip, then the wait for the outcome).
  - **The chosen speed stays set** (II / 10× / 100× / 1000× mission days a minute; `OPS_SPEEDS` in `useOpsSession.ts`, a flight opens paused and PLAY resumes at 100×, the "default speed"): a card, a result, the eclipse card or an overlay only *holds* the clock (`locked` / `setHold`), and time runs on by itself once it clears. A transit that cannot advance is cleared (stall guard).
  - **FINISH MISSION** (`finish()` → engine `finishOperations`): the robot flies the rest with its default responses and ends at the extension decision, so every flight reaches the report. The footer shows `missionProgress` (bar + "MISSION ENDS IN …").
  - Numbers come from `consoleView`, `powerPlanPreview`, `dsnOptions` (`ops/console.ts`) and `flyTiles`, `flyCard`, `comingUp`, `eclipseCard`, `outcomeIn_s` (`ops/fly.ts`).
  - **Risk chips read "⚠ +n risk" (`riskIncrease`), never a negative number.**
  - The console panels (`components/ops/PowerDial`, `BookCall`, `OpsPanels`) are drawers.
- **Pack** (`screens/Pack.tsx`) and **Launch Day** (`screens/LaunchDay.tsx`, `components/sd/LaunchCalendar.tsx`, `sd-launch.css`; App step `launch`): the shared plan is `launchPlan.ts` (`useLaunchCalendar`, cached per level; `useLaunchPlan`: the pick or `bestLaunchDay`); App keeps the packing and the pick (`packSave`). Numbers from `pack.ts` (`buildPackDesign`, `packBlockers`, `dangerDeck`, `calendarTransfers`, `dayQuality`, `bestLaunchDay`, `fitPart`) and `evaluateDesign` / `cadetGauges`. Part data and effects live in `src/data/pack.json`; a part's effect reaches the engine through `Design.kit`. Volume (the nose) and weight (the launch meter) are separate limits, and each blocker names the one that failed; "no fuel" also names the shelf part that fixes it when the engine finds one does (`packBlockers` `fix`, e.g. Moon 3's trim burns need the extra tank). Levels carry their shelf (`levels.ts` `shelfOf`).
- **Science Targets** (spec UI rules 39–46; vision line two: bring the science home): after arrival at Mars (or on Moon 3) the robot's question opens `components/fly/ScienceTargets.tsx`. On Moon 1 and Moon 2 the same panel shows the orbit only (`OrbitOnly`, DONE · KEEP FLYING; MOON ORBIT reopens it); `nextEventT` stops when the robot's news from the science orbit reaches Earth so it opens on time.
  - **The globe is the hero** (spec v0.9): it fills the CRT, with a slim target list (phone: `TargetSheet.tsx`, a bottom sheet with peek/half/full snaps) and OBSERVE along the bottom.
  - **The clock:** the panel holds it with `setHold('orders')`. Each OBSERVE (`useOpsSession.observe`) still plays its trip (`orderTrips`: light time out, then the reply back with "IMAGE QUEUED"); every other hold is `true`.
  - **The globe** is `Globe.tsx`, one component for Mars and the Moon (`body` prop; map from `TARGET_SETS[body].globe`, view and zoom from `sdGeometry` `GLOBE_BODY`): it measures its box (`useBoxSize`) and picks three.js `Globe3D.tsx` (lazy chunk; camera eases to the target) or `Globe2D.tsx` (fallback; same drawing, no camera motion). Also `useGlobeMode` / `sd.globe`, and the frame-rate floor in `globeRules.ts`.
  - **The Moon scene** (spec UI rule 45; design `docs/design/3d/Moon Globe.html`) comes from the engine's `moonOrbitView` (`ops/moonView.ts`, body frame: Earth, Sun, the orbit plane, far-side and shadow arcs, a polar pass per Moon 3 target, the link, the next trim burns). `sdGeometry` turns it into the view frame (`moonOverview` follows the orbit plane, `moonLayout` fits the Moon and Earth, `lunarRing`, `ringSplit`, `signalEnd`, `trimAt`, `MOON_SCENE`); the orbiter's lap is a picture, its link is `linkUpOnRing`. `GlobeMarks.tsx` `MoonMarks` draws Earth's brackets and label, the // break, the trim diamond, the link line and the ring's legend. Words: `MOON_WORDS`. The trim tag shows where the level teaches fuel (`FlyAndSurvive` `teaches`).
  - **Shared globe pieces:** the drawing is `sdGeometry` (view-frame vectors, `orbitDrawRadius` (altitudes drawn compressed, labels in real km), `globeFrame`, `globeOrbits`). The HTML markers and labels are `GlobeMarks.tsx`.
  - **The flyover** starts from the engine moment `observe` (`momentsSince`).
  - **The arrival transition** is `arrivalZoom.ts`: CSS variables and `Date.now`, instant under reduced motion; it measures `.sci-globe-anchor`, the disc at the overview.
  - Pictures come home through `Downlink.tsx`.
  - Numbers come from `scienceTargetsView` (`orbit`, each card's `pass`, `dips`, `moonTransfer`, `dragFactor`, `risk`), `consoleView.commands` (an order's `targetId`, `timeLeft_s`), `downlinkView` and `missionAlbum`. Science returned (`scienceReturned`) is the main score; stars are first science home, ≥ 50%, ≥ 80% (`STAR_RULES`). Images: `src/data/targets.json` and `moonTargets.json` (LROC PDS frames), copies by `scripts/fetch-targets.py [dir] [mars|moon|all]`. Shots: `tests/visual/science.spec.ts`, `globe.spec.ts` (throttled phone), `moon.spec.ts` (`npm run shots -- moon`: Moon 1–3 × 3D/2D, Tsiolkovskiy observed); the Moon Globe mockup is shot by `design.spec.ts` into `docs/design/3d/shots/`.
- **Mission Report** (`screens/MissionReport.tsx`, `components/report/MissionAlbum.tsx` first at Mars, `components/report/ComicArt.tsx`, `components/report/FinalTransmission.tsx`): `finalTransmission` (the robot's last message first; words `FINAL_WORDS` / `finalLines`; FEED THE PAPER starts the comic), `operationsDebrief`, `reportPanels`, `reportVerdict` and `reportCompare` (`ops/report.ts`), star rules from `STAR_RULES`, and risk from `useOpsRisk`.
- **Home / Daily / Notebook** (`screens/Home.tsx`, `Daily.tsx`, `Notebook.tsx`; Home: PLAY and DAILY are the big keys, `.hm-second` holds Rescue, Notebook, Postcards and the mode lever): counts from `notebook.ts` (`notebook`, `notebookProgress`, `rescueProgress`, `flightFacts`, `newLessons`) and `daily.ts` (`dailyNumber`, `dailySeed`, `dailyDesign`, `dailyGrid`, `dailyStreak`, `nextDailyIn_s`). Lessons live in `src/data/notebook.json` and each points at an existing Sourced text. Notebook facts and Daily results are saved in the browser (`src/ui/saves.ts`).
- **Things that make players care** (spec UI rules 31–35; none of it changes the simulation):
  - **Storms come from the Sun:** `FlightFrame.sun` (Sun-centred maps: the centre; Moon map: −r_earth, drawn on the edge by `sdGeometry.sunOnMap`) and `stormFront` (`ops/fly.ts`); `CrtMap` draws the wave (`stormWave`) and labels the Earth pulse YOUR ORDER.
  - **The robot talks:** name tag on Pack (`components/sd/NameTag.tsx`, `saves.ts` `sd.robot`); `ops/voice.ts` `robotMessages` (events + ledger: replies to orders, routine status every `VOICE_RULES.statusEvery_days`, science milestones), `heardMessages` (each message arrives one light time late) and `transmissionFeed` (robot lines + your orders with their status and leg progress); `components/fly/Transmissions.tsx` (the TRANSMISSIONS teletype; phone: LOG strip), the reply box and the reply's pulse home (`useOpsSession` `Transit.replyAt`); the report shows the last message. Lines are templates in `sdWords.ts` (`VOICE`, `STATUS_VOICE`, `fill`, `robotSays` with `voiceContext.ts`), words for the teletype in `TX_WORDS`.
  - **Moments and sound:** `countdownAt` and `momentsSince` (`ops/fly.ts`); `components/fly/Moment.tsx` (launch countdown on the first flight of each level, `sd.seen` `launch:<level>`; arrival and storm banners); `src/ui/sound.ts` (one Web Audio manager, `createSound`: one-shot cues (`play`) and held loops (`useLoop`: hum, clack, static, rattle); nothing sounds before the first click, tap or key (`installUnlock`), a hidden tab pauses it, silent without audio; the mute key `SoundToggle` is in every top bar, saved as `sd.sound`; `tests/ui/sound.test.tsx` mocks the AudioContext, `fakeAudio.ts`). Where they sound: `useTeletype` clacks, Home / Name Your Robot / Fly hum, `FlyAndSurvive` plays static while a feed order is `in-flight` or `reply-inbound` and beeps when one lands, `Downlink` rattles while it prints (`tests/ui/soundCues.test.tsx`). Styles in `sd-moments.css`.
  - **Postcards:** `src/data/postcards.json` (NASA public-domain pictures, copies in `public/postcards/`, served under `import.meta.env.BASE_URL`), engine `postcards.ts` (`postcardsEarned`, `postcardAlbum`, `newPostcards`), `screens/Postcards.tsx`, `components/sd/PostcardView.tsx`, the flight toast and the report strip; saved as `sd.postcards`.
  - **Ranks and badges:** `src/data/ranks.json`, engine `ranks.ts` (`starTotals`, `rankFor`, `badges`, `newBadges`; badge facts in `notebook.ts` `flightFacts`), `components/sd/CrewFile.tsx` (Home plate and panel); the report shows PROMOTED! / NEW BADGE against the crew file at launch.
  - The screenshot specs pre-set `launch:*` in `sd.seen`; `tests/visual/storm.spec.ts` shoots the storm, `help.spec.ts` the countdown.
- **Live NASA data** (spec UI rules 36–37):
  - **Mars right now** (`marsNow`, `components/sd/MarsNowPlate.tsx`) is today's ephemeris: no network.
  - **The Daily's real Sun.** The game reads only `public/data/donki-latest.json` (`src/ui/donki.ts` `loadSpaceWeather`, cached per day as `sd.donki`); it never calls CCMC. The snapshot comes from `.github/workflows/donki.yml` and `scripts/fetch-donki.mjs`. `spaceWeather.ts` turns it into dangers (`realStorms`: SEP → `solar-storm`, a CME with a WSA-ENLIL Mars impact → the live-only `cme-shock`, flares only as context; `stormCandidates`, `stormSourced`, `predictionSourced`); `StartOptions.storms` replaces only those two streams, and a CME's severity scales `effectiveFailureChance`; `dailySeed(date, storms)` and `dailyGrid(s, weather)` record it. Words in `sdWords.ts` `LIVE_WEATHER` / `MARS_NOW`.
  - **Tests.** `tests/ui/setup.ts` stubs `fetch` to fail, so component tests are offline. `tests/fixtures/donki/documented-format-sample.json` is hand-written (not a recording) for the threshold edges; `flr-`/`cme-2024-05-08_2024-05-14.json` are real CCMC responses recorded by the Action's manual run (`recorded.json`), and a shape test reads the snapshot the Pages build just fetched (skipped where there is none, e.g. on a pull request). The screenshot specs route the snapshot (`helpers.ts` `routeDonki`).
- Words live in `src/ui/sdWords.ts` (Signal Delay), with `opsWords.ts` for the drawers. Pixel layout lives in `src/ui/sdGeometry.ts`. Levels and saved stars are in `src/ui/levels.ts`. New display constants go in `FLY_RULES` / `CONSOLE_RULES` / `pack.json`, registered in the data audit.
- **Component tests** (`tests/ui/*.test.tsx`) start with `// @vitest-environment jsdom` and import `./setup` (cleanup, empty storage, `openMarsLevel`). jsdom has no Web Worker, so `setup.ts` runs the Risk Monte Carlo inline with `TEST_RISK_RUNS` (20) runs. With fake timers, advance time in small slices: each animation step schedules the next.
- **EN / বাংলা** (spec UI rule 48): `lang.ts` (`lang`, `setLang`, `useLang`, `tr`; saved as `sd.lang`, sets `<html lang>`) and `components/sd/LangToggle.tsx` beside every `SoundToggle`. Each `sdWords.ts` export is wrapped in `tr('NAME', …)` and answers in the current language; its Bangla is the export of the same name in `sdWords.bn.ts` `BN` (typed as the full `Bangla`, so a missing word is a compile error; `place` / `placeIn` / `placeOf` for planet names). `opsWords.ts` does the same with `tr(…, 'ops')` and `BN_OPS` (drawers: `DRAWER_WORDS`). Tables are handed out as live proxies, so a module constant still follows a switch. Numbers are formatted as in English; time words in sentences go through `FLY_WORDS.duration` (`format.ts` `durationParts`), never `f.durationWords` in a screen; mission, target and robot names stay English; the engine's hazard titles and questions are said through `FLY_WORDS.hazard` / `FLY_WORDS.prompt`. `App` calls `useLang()` so a switch re-renders in place. A new word goes into `sdWords.ts` / `opsWords.ts` (never a literal in a screen) with its Bangla; `tests/lang.test.ts` fails on a missing or non-Bangla word, or a Bengali digit. The data's cited texts (real history, `learn`, postcard titles and captions, Rescue History's clues and findings, lessons, rank jobs) are said through `cited.ts` `said(text)`, their Bangla in `cited.bn.ts` keyed by the exact English (`tests/cited.test.ts` fails on a missing or stale one, or a changed number); hand ⓘ (`SourceInfo`) the Sourced record itself, so it shows the English original. Level titles stay English; `LEVEL_WORDS` holds what each teaches (in Bangla, `LEVEL_WORDS.sub` under the title). Dates go through `fullDate` / `shortDate` / `crtDate`, never `f.isoDate` in a screen. Still English: the Engineer Build Bay and Engineer readouts, and the engine's blockers. Bangla shots: `tests/visual/bangla.spec.ts` (`npm run shots -- bangla`; fails on a page that scrolls sideways, logs spilling labels to `bn-spills.txt`).

## Architecture

**Data flow.** `src/data/*.json` (Sourced values) → `src/engine/data.ts` (typed casts plus `lookup()`) → physics modules → `src/engine/index.ts` (and `compare.ts`), which the UI calls.

**Signal Delay engine modules:** `science.ts` + `targets.ts` (what a target picture costs; Mars' six targets in `targets.json`, Moon 3's four in `moonTargets.json`), `objectives.ts` (Mars mission objectives, `objectives.json`: `targetWeight` ties a target's weight to the instruments packed; `objectiveResult` in `ops/observe.ts`), `ops/link.ts` (behind the Moon: `linkUpAt`, `nextAos`), `ops/moonView.ts` (the Moon globe's view), `ops/observe.ts` (OBSERVE orders, pictures, science returned) and `ops/scienceView.ts` (Science Targets panel, Downlink drawer, Mission Album), `pack.ts` (Pack: nose, part effects, danger deck, launch calendar), `ops/fly.ts` (Fly & Survive view model), `ops/voice.ts` (the robot's messages), `ops/report.ts` (Mission Report), `notebook.ts` (Engineer's Notebook), `daily.ts` (Daily mission), `postcards.ts` (Postcards), `ranks.ts` (ranks and badges), `marsNow.ts` (Mars right now on Home) and `spaceWeather.ts` (DONKI snapshot → the live Daily's real storms).

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
