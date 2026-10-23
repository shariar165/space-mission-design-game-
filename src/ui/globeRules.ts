// The 3D globe's frame-rate floor (spec: UI rule 41), kept apart so the screenshot specs can read it too.

/** Below this many frames a second (two seconds running) the 3D globe gives way to the flat one. */
export const GLOBE_MIN_FPS = 30;
/** How long the frame rate must stay below the floor before the flat globe takes over (ms). */
export const GLOBE_WATCH_MS = 2000;
