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
