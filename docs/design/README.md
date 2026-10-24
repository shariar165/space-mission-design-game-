# Design references

Mockups from the Claude Design project **"Build Bay and Debrief mockups"**:
https://claude.ai/design/p/c7f6be74-4ab5-4b91-ad14-112f0dc4ff77

| Screen | Design file | Implemented in |
| --- | --- | --- |
| Build Bay | `Build Bay.dc.html` (copy here) | `src/ui/screens/BuildBay.tsx` |
| Debrief | `Debrief.dc.html` (copy here) | `src/ui/screens/Debrief.tsx` |
| Operations Console (canvas: states and close-ups) | `Operations Console.dc.html` | `src/ui/screens/OpsConsole.tsx`, `src/ui/components/ops/*` |
| Operations Console, desktop 1440 | `Ops Console Desktop.dc.html` | same, `src/ui/styles/ops.css` |
| Operations Console, phone 390 | `Ops Console Mobile.dc.html` | same, `@media (max-width: 760px)` in `ops.css` |
| Design Components runtime | `support.js` | not shipped; lets the `.dc.html` copies render |

The `.dc.html` files need the Design Components runtime (`support.js`) from the project to render; they are kept here only as a reference and are not shipped. All numbers in the mockups are placeholders: the game shows engine output only (see `docs/SCIENCE_SPEC.md`, "UI rules").

Both copies were unescaped from the Claude Design API on Oct 3, 2026; their sizes match the project files exactly (Build Bay 85,501 bytes, Debrief 44,122 bytes).

The Operations Console files were imported on Oct 4, 2026 through the claude_design MCP. Each copy matches the project file byte for byte: Operations Console 30,643, Ops Console Desktop 88,451, Ops Console Mobile 47,204, support.js 69,150. The desktop file was also checked identical to the API's own read. The console follows the mockup's six states (normal, hazard, queue, blackout, safe mode, extension) and its two close-ups (Upcoming timeline with "Book a call home", the Power dial). Where the mockup shows something the engine does not model, the console shows the engine's own result instead (spec UI rules 16–20).

The Cadet screens (Level map, guided build, Flight and Mission Control, Rescue History) have no mockup: they were designed directly in code (`src/ui/styles/cadet.css`) because the Claude Design connection was unavailable. They are checked at 1440 px desktop and 390 px phone widths.

## Signal Delay (current UI, Oct 5, 2026)

Imported through the claude_design MCP from the same project. Each copy in `signal-delay/` matches the project file byte for byte (Fly and Survive 51,581; Pack 30,521; Mission Report 27,681; Home (+ Daily share) 24,737; Notebook 18,488; SDIcon 4,456). `signal-delay/shots/` holds reference screenshots of each frame at 1440 × 900 and 390 × 844 (`npm run shots -- design`).

| Screen | Design file (frames) | Implemented in |
| --- | --- | --- |
| 01 Fly & Survive | `Signal Delay - Fly and Survive.dc.html` (1a, 1b) | `src/ui/screens/FlyAndSurvive.tsx`, `components/fly/*`, `styles/sd-fly.css` |
| 02 Pack | `Signal Delay - Pack.dc.html` (2a, 2b) | `src/ui/screens/Pack.tsx`, `styles/sd-pack.css` |
| 03 Mission Report | `Signal Delay - Mission Report.dc.html` (3a, 3b) | `src/ui/screens/MissionReport.tsx`, `components/report/ComicArt.tsx`, `styles/sd-report.css` |
| 04 Home | `Signal Delay - Home.dc.html` (4a, 4b) | `src/ui/screens/Home.tsx`, `styles/sd-home.css` |
| 05 Daily share | `Signal Delay - Home.dc.html` (5a, 5b) | `src/ui/screens/Daily.tsx`, `styles/sd-daily.css` |
| 06 Notebook | `Signal Delay - Notebook.dc.html` (6a, 6b) | `src/ui/screens/Notebook.tsx`, `styles/sd-notebook.css` |
| Mission map, Rescue History (no mockup) | the screens' chassis, panels, paper and type | `styles/sd-cadet.css` |
| Icons | `SDIcon.dc.html` | `src/ui/components/sd/SDIcon.tsx` |
| Tokens | all of the above | `src/ui/styles/theme.css` |

Differences from the mockups, on purpose:
- The canvas controls (the "JUMP TO" buttons, the "SCREEN 0X OF 06" headers and the phone's 9:41 status bar) are not shipped.
- Every number is engine output. The mockups' numbers are placeholders, and so is their "−2 RISK" chip: the game shows "⚠ +n risk".
- Pack adds a weight scale beside the nose, because weight is a separate limit from volume.
- The Mission Report compares launch date, planned science and mass/power/Δv, not burn length or actual lifetime (spec UI rule 5).
- Responses with three choices put the third under the danger card. Every danger card offers "Let the robot decide".
- Home's kicker reads "MISSION CONTROL · DEEP SPACE" (no year), and Home adds "Choose a mission" and the mode lever.
- The Daily share card has one square per danger answered (held / cost you / hurt) rather than four placeholder squares. Its title comes from the first danger faced.
- The Notebook holds the lessons the data can source (15), not 24.

## Name Your Robot, transmissions and final transmission (Oct 21, 2026)

`Signal Delay - Name Your Robot.dc.html` (19,069 bytes; frames 0a, 0b) is implemented in `src/ui/screens/NameRobot.tsx` and `styles/sd-name.css`. The same import updated Fly and Survive (the TRANSMISSIONS teletype) and Mission Report (FINAL TRANSMISSION).

## Science targets, downlink, mission album and the Mars globe (Oct 23, 2026)

Imported through the claude_design MCP, and the same check applies: each copy matches the project file byte for byte. `read_file` returns HTML-entity-escaped text, so every copy was decoded and its size compared with the project listing.

**Signal Delay copies in `signal-delay/`.**
- Current sizes: Fly and Survive 100,354; Mission Report 48,945; Name Your Robot 19,069; Home 24,737; Notebook 18,488; Pack 30,521; SDIcon 4,456; support.js 69,150.
- **Fly and Survive** adds the Mars-orbit phase. The CRT turns to a Mars globe with six SCIENCE TARGETS cards, an OBSERVE key and DONE · KEEP FLYING. It also adds the DOWNLINK drawer on the TRANSMISSIONS paper: a queue, the next DSN pass, a dithered print line by line, then the image in full colour with its credit and the robot's comment. New JUMP TO states: SCIENCE TARGETS and DOWNLINK.
- **Mission Report** opens with the MISSION ALBUM, which comes before FINAL TRANSMISSION and the comic. It shows one frame per target: in colour if the picture came home, SIGNAL LOST if it was cut off, NOT RETURNED if it never left. Above the frames is a science bar with one block per target, sized by what that target teaches.
- The project also keeps `… (before science)` and `… (before album)` versions of these two files. They are the copies imported on Oct 21 and are not copied again.

**Mars globe in `3d/`.** From the project https://claude.ai/design/p/b3c517da-8be3-4c68-b563-65378ba39d71.
- Files: `Mars Globe.html` 11,402; `three-d-stage.js` 18,742; `crt.css` 2,323; `mars-map.js` 11,588.
- It is the only 3D element in the game: the globe in the Fly & Survive CRT after arrival. Fly & Survive keeps its 2D map, so the project's `Orbit View.html` is not used.

**Differences from the mockups, on purpose.**
- The globe uses a real NASA surface map, the USGS Viking colorized global mosaic, not `mars-map.js`'s procedural map. The mockup's Jezero marker is replaced by the game's six targets.
- The design's pictures (`signal-delay/assets/mars/*.jpg`) are binary, and the MCP returns text only, so they could not be copied. The game ships its own copies of the NASA images, each one checked against its Photojournal page (`src/data/targets.json`). The same files are placed under `signal-delay/assets/mars/` with the design's names, so the mockups render.
- Every cost, risk, size and time on a target card or in the drawer is engine output.

## The Mars globe as the hero of Science Targets (Oct 24, 2026)

There is no new design file. The layout follows the user's brief, using the "Mars Globe" page (`3d/`) for the globe and the existing Fly & Survive shell. The project was re-read through the claude_design MCP:
- **`3d/` copies:** each of `Mars Globe.html` (11,402), `crt.css` (2,323) and `three-d-stage.js` (18,742) still matches its local copy, apart from line endings (the local files are CRLF: one extra byte per line).
- **Not imported:** the project now also holds `Orbit View.html` and `orbit-maps.js`, a 3D cruise view. They are left out because spec rule 41 keeps Fly & Survive on its 2D map, with no 3D orbit view.

**From the "Mars Globe" page:**
- the phosphor glow;
- a reticle with a pulse on the selected target;
- the moons on their rings;
- an orbiter on an orbit ring;
- labels in the page's `.lbl` style (a bright key line over a dim sub line).

**Different on purpose:**
- **The orbit:** the design draws an inclined circle at 1.42 Mars radii. The game draws the engine's ellipse on a compressed altitude scale, with real-km labels (spec rule 41).
- **The camera:** the design's free orbit controls are replaced by camera moves to the target the player picks.
- **The toolbar:** the design's export toolbar is not shipped.
