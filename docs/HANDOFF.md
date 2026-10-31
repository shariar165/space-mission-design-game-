# Handoff: where Signal Delay stands

State on **Oct 28, 2026**, at the feature freeze, plus the Team Mode engine (Oct 31, PRs #47–#50, see below). `main` is clean, CI green, deployed to https://shariar165.github.io/space-mission-design-game-/ .

Read this first in a new session, then `CLAUDE.md` (commands, architecture, UI rules) and the relevant section of `docs/SCIENCE_SPEC.md` (v1.2, the source of truth for every equation and rule).

## Health at the freeze

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` | 716 tests pass (engine, validation, data audit, jsdom components) |
| `npm run shots` (full suite, both sizes) | 75 pass, 1 skipped by design (the throttled-globe check runs only on the phone project) |
| Bangla shots | no page scrolls sideways; `test-results/shots/bn-spills.txt` empty |
| Validation | every `validation` row passes within ±10% (`docs/VALIDATION_RESULTS.md`) |
| Data audit | 419 values are labelled game estimates (`TODO_DATA.md`) |

## What is merged

Every change reached `main` through a pull request with CI green.

| PRs | What |
| --- | --- |
| #1–#3 | Engine, Build Bay and Debrief; Mission operations engine and console |
| #4–#6 | Signal Delay UI from Claude Design (Pack, Fly & Survive, Mission Report); GitHub Pages deploy; Home, Daily, Notebook |
| #7–#10 | New-player help (briefings, coach, Back everywhere), game fonts; robot voice, postcards, moments, ranks, storms from the Sun; README and licence |
| #11–#14 | Live NASA data: DONKI snapshot workflow, Mars right now, the Daily's real Sun; CI on every PR; DONKI fetch in the Pages build |
| #15–#19 | Vision in the spec: Name Your Robot, transmissions teletype, final transmission, Home rows, Launch Day step |
| #20–#27 | Science targets (vision line two): Mars targets, downlink, mission album, 3-D globe; science returned is the main score; globe as hero (spec v0.9) |
| #28–#34 | Moon (spec v1.0): far-side loss of signal, LRO station-keeping, four Moon targets with LROC pictures, one shared globe for Mars and the Moon |
| #35–#38 | Sound (one Web Audio manager, mute key) and the Mars Climate Orbiter cold open with its RECEIVE TRANSMISSION gate (spec v1.1) |
| #39–#44 | EN / বাংলা switch on every Cadet screen; cited texts, Rescue History and the mission map in Bangla with the English original in ⓘ (spec v1.2) |
| #45 | Full screenshot run before the freeze: ribbon labels never overlap, the countdown keeps clear of the robot, the 1,000× key fits, Bangla day counts |

## In progress: Team Mode (spec v1.3, Oct 31, 2026)

The engine is merged (PRs #47–#50); the UI is next. The approved plan is in `~/.claude/plans/breezy-pondering-clarke.md`.

**Done (engine):**

| PR | What | Code | Tests |
| --- | --- | --- | --- |
| #47 | Mars mission objectives: atmosphere, surface, moons | `objectives.json`, `src/engine/objectives.ts` (`targetWeight`), `objectiveResult` in `ops/observe.ts` | `tests/objectives.test.ts` |
| #48 | Team core: roles, permissions, the one action log, `LocalTransport`, `replayTeam` / `stepSession`, danger-card votes | `team.json`, `src/engine/team/` | `tests/team.test.ts` |
| #49 | Each role's share of mass, budget and nose squares; conflicts | `team/negotiate.ts` (`teamSpend`, `teamConflicts`) | `tests/teamNegotiate.test.ts` |
| #50 | Each role's key decision and the team score | `team/report.ts` (`teamReport`, `teamScore`) | `tests/report.test.ts` "team section" |

The objectives use the instrument-match rule: the objective's targets carry 60% of the science only with a matching instrument packed (user choice).

**User decisions:**
- The team score is separate: it never changes the stars.
- Roles are optional and open: anyone may act for an empty role. With no Flight Director, cards go by majority; a tie goes to the recommendation.
- Objectives are Mars only; the Moon levels and the Daily stay balanced.
- Each seat gets a colour and a call sign from a preset list. There is no text input; the team uses quick messages only.
- Mass, budget and nose space use the real limits, with no team-only caps.

**Next (UI), each a small PR with shots at 1440 and 390:**
1. **Import the mockup.** Through the claude_design MCP, import `Signal Delay - Team Setup.dc.html` (+ `support.js` if changed) from https://claude.ai/design/p/c7f6be74-4ab5-4b91-ad14-112f0dc4ff77 into `docs/design/signal-delay/`. Add it to `design.spec.ts` `SCREENS`. The MCP was refused (403) in the session that built the engine; a new session after `/design-login` should reach it.
2. **Team Setup screen** (`screens/TeamSetup.tsx`, `sd-team.css`, App step `team`, a TEAM key in Home `.hm-second`, `sd.team` in `saves.ts`):
   - a `useTeam` hook over `LocalTransport` that feeds `stepSession`;
   - the objective picker, also on the solo Pack briefing (Mars) and in Build Bay;
   - `TEAM_WORDS` / `OBJECTIVE_WORDS` in `sdWords.ts` with Bangla.
3. **Pack and Fly & Survive:**
   - Pack: a role chip on each part, a `teamSpend` strip and a conflict banner.
   - Danger card: a vote strip (recommend, votes, the Flight Director's CALL); the clock held with `setHold`.
   - A quick-message panel, and keys marked with the role that owns them.
4. **Report and docs:** a `teamEl` section in `MissionReport.tsx`; README (Team Mode, objectives); this file and CLAUDE.md.

## Open items

1. **Delete `OpsSummary`.** `src/ui/components/ops/OpsPanels.tsx:269` is dead code from the old operations console: no screen imports it, and its words are English only. Remove the component, its last assertions in `tests/ui/opsDrawers.test.tsx` (the `render(<OpsSummary …>)` lines and the import), and its styles: `.ops-summary` in `src/ui/styles/ops.css` (lines 282, 295–302, 399) and in `sd-fly.css` (lines 149, 260, 261). Keep `.ops-ext` and `.ops-ext-title`, which `ExtensionDecision` still uses. Run `npm test` and the `fly` and `report` shots.
2. **"Judge in 3 minutes" README section.** Not written yet. A short section near the top of `README.md` (and in its Contents list) for a judge with three minutes. It should give the play link, one path through the game (for example Moon 1 or Mars: Pack, Fly & Survive at 100×, the Science Targets globe, the Mission Report), and where the real science shows: ⓘ on any number, Engineer mode's EQUATIONS drawer, `docs/VALIDATION_RESULTS.md`. Use screenshots already in `docs/images/` or fresh ones from `test-results/shots/`.
3. **Atlas V payload curves are placeholders.** `src/data/launchVehicles.json` `atlas-v-401` and `atlas-v-411` `payloadCurve` are game estimates. NASA's LSP Performance Query (elvperf.ksc.nasa.gov) can only be used interactively, so a person must export 6–8 points per vehicle (C3 −2 to 40 km²/s²). Until then the launch-capacity validation rows are not real evidence. After the export: set `isGameEstimate: false` with the source and URL, then run `npm run test:validation` and `npm run todo-data`.

Smaller follow-ups, not blocking:
- The real-history texts in `src/data/hazards.json` and `crisisCards.json` are marked **"to verify"** until checked against NASA's Lessons Learned Information System or the official failure reports. In Bangla they keep the tag.
- Still English by design: the Engineer Build Bay, the Engineer readouts and the engine's blockers. Any of these that moves to Bangla goes through `sdWords.ts` / `sdWords.bn.ts` like the rest.

## Known limitations

The models are simplified on purpose. The full list is in the README ("Known limitations") and the spec ("Assumptions"); in short:
- Patched conics and a zero-revolution Lambert solver. No gravity assists; Bennu's flyby is a fixed, labelled route.
- JPL approximate ephemeris (1800–2050); for the Moon, the mean Earth–Moon distance and no libration.
- Comms anchored to MRO's design point; the 34 m station behind it is inferred, so the Data meter carries an estimate badge.
- Operations: inertially fixed orbits (no J2), cylindrical shadows, independent Poisson hazards, no lunar eclipse; Moon trim burns are LRO's published pair, not a gravity model.
- Science targets: camera resolution, weights and drag heating are game estimates; the Cadet Mars campaign is shortened to 100 days.
- The live Daily replays real DONKI events on a game timeline; it does not predict CME propagation.
- Atlas V launch curves are placeholders (open item 3).

## Rules we follow

From `CLAUDE.md`, the spec and the user. They are not optional.

- **Tests first.** Write the `tests/physics.test.ts` (or the matching engine test) case before the code, with the hand calculation in a comment next to each assertion.
- **Every value is `Sourced<T>`.** `value`, `unit`, `source`, optional `url`, `isGameEstimate`. `tests/dataAudit.test.ts` fails on a bare number in `src/data/*.json`; engine-level constants are registered in its `ENGINE_VALUES`. Estimates and "approx." / "to verify" values get `isGameEstimate: true` and are never presented as NASA data.
- **Validation:** when a check fails, fix the model or the data, never the expected value.
- **The UI never computes a number.** It calls the engine and only formats units. New on-screen numbers go into the engine with a test. `tests/uiGuards.test.ts` enforces it.
- **Every word has a Bangla version** (`sdWords.bn.ts`, `cited.bn.ts`); `tests/lang.test.ts` and `tests/cited.test.ts` enforce it. Numbers stay Latin digits; mission, target and robot names stay English.
- **Toolchain only in `.venv`.** Node 22.16.0 lives there via nodeenv; never install anything globally. Put `.venv/Scripts` first on PATH.
- **Small PRs to `main`.** `main` is protected and requires the "Typecheck and tests" check; nothing pushes to it directly. One topic per PR; branch from the latest `main`; merge only with CI green.
- **CI must pass.** `ci.yml` runs typecheck and tests on every PR; the Pages deploy runs the same tests and stops on a failure.
- **Shots in the foreground.** Before a release, run the screenshot suite in the foreground, one or two spec files per call (`npx playwright test tests/visual/<a>.spec.ts`), with 1 worker; split `bangla.spec.ts` with `-g`, as it runs past 10 minutes alone. A full run in one call times out or is killed for memory. Look at the PNGs by eye.
- **Commit and PR footers.** Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Never edit generated files** (`docs/VALIDATION_RESULTS.md`, `TODO_DATA.md`) by hand; rerun the tests that write them.

## Traps we hit

- `design.spec.ts` rewrites the tracked PNGs under `docs/design/**/shots`. Their small pixel noise (under 2%) comes from animation frames: restore them with `git checkout -- docs/design` unless a design copy really changed.
- Never junction `node_modules` into a git worktree: `git worktree remove --force` deleted the real `node_modules` once.
- Bangla: a counter word (টি) right after a digit makes the browser draw the digit in the Bangla font, so write "26 ঘর", not "26টি ঘর". Dates go through `fullDate` / `shortDate` / `crtDate` and day counts through `dayCount`, never `f.isoDate` / `f.days` in a Cadet screen.
- React keys on the coming-up ribbon must include the slot index: two events can share a kind and a day (two course fixes), and a duplicate key leaves a ghost label behind.
- In Git Bash, set `MSYS_NO_PATHCONV=1` when trying a base path, or the path is mangled. Long scripts with backticks and quotes are safer written to a file than passed through a heredoc.
