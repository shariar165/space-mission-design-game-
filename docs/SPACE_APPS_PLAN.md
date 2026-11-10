# Plan: make mission design the star before Space Apps (Nov 14–15, 2026)

Put this file in the repo as `docs/SPACE_APPS_PLAN.md`. Work through it one PR at a time.

## Why

The challenge is "Space Mission Design Game". The game's operations half (Fly & Survive, light delay, team votes) is strong. The design half is thin in the default Cadet path, and the README's judge route skips it. Judges score relevance to the brief, so the brief's design items must be playable in Cadet mode and visible in the first minute:

- define a mission objective
- choose a launch vehicle and an orbit
- see budget, mass, power and data as limits while designing
- change the design and fly again

This plan was written from a read of the code, docs and screenshots, without running the game. Confirm each "today" statement below before building on it.

## Ground rules

All rules in `CLAUDE.md` and `docs/HANDOFF.md` apply. The ones that matter most here:

- Read `docs/HANDOFF.md`, then `CLAUDE.md`, then the relevant part of `docs/SCIENCE_SPEC.md` before each PR.
- Spec first: add the UI rule and a decision-log entry to `docs/SCIENCE_SPEC.md` in the same PR.
- Tests first, with the hand calculation in a comment.
- Every new value is `Sourced<T>`. Game rules get `isGameEstimate: true`. Never present a guess as NASA data, and never invent a source.
- The UI never computes a number. New numbers come from the engine with a test.
- Every new word goes in `sdWords.ts` and `sdWords.bn.ts`.
- One topic per PR, branched from the latest `main`, merged only with CI green.
- After a visual change, shoot the screen at 1440 × 900 and 390 × 844 and check for clipped text.
- Never hand-edit `TODO_DATA.md` or `docs/VALIDATION_RESULTS.md`.

Two extra rules for this plan:

- **Do not break Team Mode, the Online Room or the Daily.** The new Pack choices are solo-only in the first pass. In team and online flights and in the Daily, the design keeps today's defaults. `tests/teamFly.test.ts`, `tests/online.test.ts` and the Daily tests must pass unchanged.
- **Stop and report** at the end of each PR: what changed, test results, the screenshots, anything that did not match this plan. Do not start the next PR without a go-ahead.

## Schedule

| Day | Work |
| --- | --- |
| Nov 10–11 | PR 1, PR 2, PR 3 |
| Nov 12 | PR 4, PR 5; PR 6 only if PR 1–5 are merged |
| Nov 12, end of day | Feature freeze. After this, only PR 7 and bug fixes |
| Nov 13 | PR 7, human tasks, demo video |
| Nov 14–15 | Hackathon and submission. No new features |

If time runs short, cut from the bottom: PR 6 first, then PR 4.

---

## PR 1: solo mission objective on the Mars Pack

**Today:** objectives (atmosphere, surface, moons) exist in the engine (`src/engine/objectives.ts`, `objectives.json`), but a solo player only reaches them through TEAM → SOLO. `HANDOFF.md` lists the solo picker as open.

**Build:**
- On the Mars level, the mission briefing (`components/sd/MissionBriefing.tsx`) asks the player to pick one of the three objectives before packing. The pick can be changed from MISSION INFO until launch.
- The pick goes into the design the same way the team's locked objective does (`Pack` already takes an `objective`; `App.tsx` `playLevel(level, objective, …)`).
- Pack shows the chosen objective and which instruments match it (engine `objectiveMatched`).
- The report shows whether the objective was met (engine `objectiveResult`).
- Save the pick with the packing (`packSave`).
- Moon, Venus, Bennu and Jupiter levels are unchanged.

**Tests:** engine test that a solo design with an objective scores targets through `targetWeight`; component test for the picker; Bangla words; shots of the briefing and Pack.

**Done when:** a new solo player on Red Planet picks an objective, packs for it, and the report says if it was met.

## PR 2: budget, power and data limits on solo Pack

**Today:** solo Pack appears to show only the weight scale and free squares. Budget bars exist only in Team Pack (`components/team/TeamPanels.tsx` `SharedLimits`). Confirm this first, including on the Venus level, which is meant to teach budget.

**Build:**
- A MISSION LIMITS panel on solo Pack with four bars: weight, budget, power, data. Values come from `evaluateDesign` meters (`mass`, `cost`, `power`, `data`) through an engine view function, in the same style as `cadetGauges`.
- Each bar has three states (fine, nearly over, over) from the meter status.
- Tapping a part on the shelf previews what it does to each bar before packing it (engine `designDelta` in `compare.ts`).
- Check whether a cost over the cap is already an engine blocker. If it reaches Pack only as `'other'`, add an `'over-budget'` code to `PackBlockerCode` with its own words, and block launch like `'too-heavy'`.
- Check that every level can still earn three stars with the budget limit enforced. If a level cannot, report it instead of changing the cap.

**Tests:** `tests/pack.test.ts` for the view function and the new blocker; component test for the bars and the preview; cardfit-style clipped-text check at both sizes.

**Done when:** adding the radar on Cloud Diver visibly pushes budget, power, weight and data, and an over-budget pack cannot launch.

## PR 3: choose the rocket in Cadet

**Today:** the launch vehicle is fixed per level in `src/ui/starters.ts`. Only the Engineer Build Bay lets the player change it. `launchVehicles.json` has two vehicles, Atlas V 401 and 411, with placeholder payload curves.

**Depends on a human task:** the real payload-versus-C3 points (see "Human tasks"). Do not make up curve points.

**Build:**
- A ROCKET row on solo Pack: each available rocket as a card with lift at this mission's C3, price and flight record, from the engine. On the Moon levels, include the shared ride (`rideshares.json`).
- Choosing a rocket changes the weight limit (the scale) and the budget bar from PR 2. This is the trade: more lift costs more money.
- Which rockets a level offers is level data (`levels.ts` or `pack.json`), Sourced as a game rule.
- If the human delivers real points: replace the placeholder curves, set `isGameEstimate: false` with source and URL, add any new vehicle the data covers, then run `npm run test:validation` and `npm run todo-data`.
- If the points have not arrived: ship the choice with the two existing vehicles and keep their "game estimate" badge. Do not remove the placeholder label.
- Giant Leap (Jupiter) must still teach that no offered rocket can do a direct flight.

**Tests:** engine test that the rocket choice changes the mass limit and cost as the curve and price say; validation rerun; component test; shots.

**Done when:** on Red Planet a player can pick the bigger rocket to lift a heavier pack and sees the budget bar pay for it.

## PR 4: choose the science orbit in Cadet

**Today:** capture and science orbits are fixed per level. Only the Build Bay's "Orbit & dates" tab changes them.

**Build:**
- Three science-orbit presets on the Mars Pack, as cards, for example HIGH AND SAFE, the MAVEN orbit (150 × 6,300 km, already sourced in `missions.json`) and LOW AND SHARP. Preset altitudes other than MAVEN's are game rules, Sourced and labelled.
- Each card shows what the orbit costs and gives, all from the engine: fuel for the orbit change, drag risk on low passes, picture sharpness, time in shadow.
- The choice goes through the existing design edit (`withScienceOrbit`) so `evaluateDesign` and the operations engine pick it up with no new physics.
- One short line per card explaining the trade in plain words.
- Mars only in this PR. Moon stays on the LRO orbit.

**Tests:** engine test for each preset's Δv and eclipse numbers with hand calculations; a test that the three presets give different science and risk outcomes on the same seed; component test; shots.

**Done when:** two players with the same pack but different orbits get visibly different fuel margins and pictures.

## PR 5: clear the "TO VERIFY" badges

**Today:** the real-history texts on danger cards carry a TO VERIFY badge in the game. There are nine in `src/data/hazards.json` and six in `src/data/crisisCards.json`, each sourced as "summary from general knowledge".

**Build, for each text:**
1. Find the official source: the NASA mission page, press kit, failure or mishap report, or NASA's Lessons Learned system.
2. Read it. Correct the text if it differs.
3. Set `source` and `url` to that page and `isGameEstimate: false`.
4. If no official source can be opened and read, do not clear the badge. List the text in the PR report so a person can check it or cut it.

Update the Bangla text in `cited.bn.ts` wherever the English changed. Rerun `npm run todo-data`.

**Done when:** every text is either verified with a working link or listed for a person to decide.

## PR 6 (stretch): change one thing and fly again

**Today:** the report has FLY AGAIN. Check whether it returns to Pack with the last packing kept.

**Build:**
- FLY AGAIN returns to Pack with the last pack, rocket, orbit and objective in place.
- Pack shows a small LAST FLIGHT strip: last result (stars, science returned) and, as the player edits, the change against the last design on each limit bar (engine `designDelta`).
- The report's "what hurt you" panel names the Pack choice that would help, where the engine can tell.

**Done when:** a player who lost power margin can go back, add a battery, see the bar move against last time, and fly again in under a minute.

## PR 7: polish and README (after the freeze)

- Fix clipped text: the goal line in the Fly top bar ("KEEP THE ROBOT ALIVE UNTIL THE MIS…") and the last comic caption on the report. Add clipped-text checks for both.
- Delete the dead `OpsSummary` (HANDOFF open item 1).
- README, "Judge in 3 minutes": start with PLAY → Red Planet, not DAILY. New route: objective → rocket → orbit → pack against the four limits → launch → one danger card → report → team vote → বাংলা. Keep it at three minutes.
- README, "Getting started": add a plain `npm install` and `npm run dev` path for Mac and Linux above the PowerShell venv steps.
- README: add a screenshot of the new Pack and one of the team vote to `docs/images/`. Retake `report.png`.
- README, "What makes it different": lead with design trade-offs, then light delay.
- Update `docs/HANDOFF.md` and `CLAUDE.md` for everything merged.

---

## Human tasks (not for Claude Code)

1. **Export the launch curves today.** On NASA's Launch Services Program performance site (elvperf.ksc.nasa.gov), export 6–8 payload points per vehicle for C3 from −2 to 40 km²/s², for Atlas V 401, Atlas V 411 and one or two other vehicles the tool offers. Give Claude Code the numbers with the query date. PR 3 needs them.
2. **Ask the Local Lead** whether work done before Nov 14 is allowed in a submission, and how to declare it.
3. **Test an Online Room on real phones** on the network you will demo on. Keep local co-op ready as the fallback.
4. **Nov 13:** read the Project Submission and Judging & Awards guides when they come out, and adjust the demo to their format.
5. **Record the demo in English**, following the new judge route.
6. **Submission form:** list every NASA dataset, image and library in References, and state the AI help (Claude Design mockups, Claude Code commits).

## First prompt to give Claude Code

> Read `docs/HANDOFF.md`, `CLAUDE.md` and `docs/SPACE_APPS_PLAN.md`. Confirm the "Today" statement for PR 1 against the code and tell me if it is wrong. Then do PR 1 only, following the ground rules. When the tests pass, show me the diff summary and the screenshots, and wait for my go-ahead before opening the pull request.
