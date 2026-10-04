# Design references

Mockups from the Claude Design project **"Build Bay and Debrief mockups"**:
https://claude.ai/design/p/c7f6be74-4ab5-4b91-ad14-112f0dc4ff77

| Screen | Design file | Implemented in |
| --- | --- | --- |
| Build Bay | `Build Bay.dc.html` (copy here) | `src/ui/screens/BuildBay.tsx` |
| Debrief | `Debrief.dc.html` (copy here) | `src/ui/screens/Debrief.tsx` |

The `.dc.html` files need the Design Components runtime (`support.js`) from the project to render; they are kept here only as a reference and are not shipped. All numbers in the mockups are placeholders: the game shows engine output only (see `docs/SCIENCE_SPEC.md`, "UI rules").

Both copies were unescaped from the Claude Design API on Oct 3, 2026; their sizes match the project files exactly (Build Bay 85,501 bytes, Debrief 44,122 bytes).

The Cadet screens (Level map, guided build, Flight and Mission Control, Rescue History) have no mockup: they were designed directly in code (`src/ui/styles/cadet.css`) because the Claude Design connection was unavailable. They are checked at 1440 px desktop and 390 px phone widths.
