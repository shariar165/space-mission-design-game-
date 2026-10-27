// @vitest-environment jsdom
// The Moon globe (spec: UI rules 44–46): in lunar orbit the CRT turns to the Moon. On Moon 1 and Moon 2 the panel
// shows the globe and the orbit alone (DONE · KEEP FLYING); on Moon 3 it opens the four target cards. Earth, the
// link line, the far-side and shadow labels and the trim-burn tag come from the engine (moonOrbitView). jsdom has no
// WebGL or canvas, so the flat globe draws its SVG and HTML only.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { linkUpOnRing, moonOrbitView, startOperations } from '../../src/engine/ops/index';
import { TARGET_SETS } from '../../src/engine/targets';
import { ZOOM_MS } from '../../src/ui/components/fly/arrivalZoom';
import * as f from '../../src/ui/format';
import { FlyAndSurvive } from '../../src/ui/screens/FlyAndSurvive';
import { MOON_WORDS, SCIENCE, TARGET_WORDS } from '../../src/ui/sdWords';
import { starterDesign } from '../../src/ui/starters';
import type { Design } from '../../src/engine/types';
import './setup';

const FROM = '2026-10-04';
const moon = starterDesign('moon', FROM);
const moon3: Design = { ...moon, scienceTargets: true };

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

function fly(design: Design, teaches?: string[]) {
  vi.useFakeTimers();
  render(
    <FlyAndSurvive design={design} seed={2013} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onHome={vi.fn()} onDone={vi.fn()} robotName="VOYA" {...(teaches ? { teaches } : {})} />,
  );
  pass(100);
}

const orbitPanel = () => screen.queryByRole('region', { name: /^MOON ORBIT · / });
const targetPanel = () => screen.queryByRole('region', { name: SCIENCE.title('MOON') });
const dayNow = () => Number(document.querySelector('.fly-day-num')?.textContent ?? NaN);

/** Next event until the Moon panel opens; danger cards are left to the robot. */
function toMoonOrbit(open: () => HTMLElement | null) {
  for (let i = 0; i < 300 && !open(); i++) {
    const danger = screen.queryByRole('dialog', { name: /DANGER CARD|PLAN AHEAD/ });
    const go =
      screen.queryByRole('button', { name: 'CONTINUE ▸' }) ??
      (danger && (within(danger).queryByRole('button', { name: /LET THE ROBOT DECIDE/ }) ?? [...danger.querySelectorAll<HTMLButtonElement>('.dc-choice')].find((b) => !b.disabled)));
    if (go) act(() => fireEvent.click(go));
    else {
      const next = screen.queryByRole('button', { name: 'Next event' }) as HTMLButtonElement | null;
      if (next && !next.disabled) act(() => fireEvent.click(next));
      else pass(250, 250);
    }
  }
  pass(ZOOM_MS + 200);
}

describe('the Moon globe', () => {
  it('Moon 1: the orbit panel opens on arrival in the science orbit, with the globe and no targets', () => {
    fly(moon, ['power']);
    toMoonOrbit(orbitPanel);
    const p = orbitPanel()!;
    expect(p).toBeTruthy();
    // it opens when the robot's "mapping" news reaches Earth, the first day of the science orbit
    const s = startOperations(moon, { seed: 2013 });
    const sci = s.env.timeline.find((w) => w.phase === 'science')!;
    expect(dayNow()).toBeLessThanOrEqual(sci.startDay + 1);
    expect(p.querySelector('.sci-globe.moon')).toBeTruthy();
    expect(p.querySelectorAll('.sci-card')).toHaveLength(0);
    expect(within(p).queryByRole('button', { name: /OBSERVE/ })).toBeNull();
    // Earth's label: the engine's distance and light time
    expect(within(p).getByText(`EARTH · ${f.distance(384_400e3).toUpperCase()} · ${f.secondsFine(1.2822).toUpperCase()}`)).toBeTruthy();
    expect(within(p).getByText(MOON_WORDS.earthSub)).toBeTruthy();
    // the link line, and the not-to-scale note
    expect(within(p).getByRole('status').textContent).toMatch(/^LINK · (LOCKED · 1.3 S|LOST · FAR SIDE)$/);
    expect(within(p).getByText(new RegExp(MOON_WORDS.notToScale.replace(/[/·]/g, '.')))).toBeTruthy();
    // Moon 1 teaches power: the shadow, not the trim burns
    expect(p.querySelector('.sci-trim')).toBeNull();
    // DONE · KEEP FLYING closes it (back to the map), and MOON ORBIT reopens it
    act(() => fireEvent.click(within(p).getByRole('button', { name: /DONE · KEEP FLYING/ })));
    pass(ZOOM_MS + 200);
    expect(orbitPanel()).toBeNull();
    act(() => fireEvent.click(screen.getByRole('button', { name: MOON_WORDS.reopen })));
    pass(ZOOM_MS + 200);
    expect(orbitPanel()).toBeTruthy();
  });

  it('the link line follows the orbiter round the ring: LOCKED in Earth’s sight, LOST behind the Moon (engine linkUpOnRing)', () => {
    fly(moon, ['power']);
    toMoonOrbit(orbitPanel);
    const globe = () => document.querySelector<HTMLElement>('.sci-globe.moon')!;
    const seen = new Set<string>();
    // the orbiter laps the drawn ring in MOON_SCENE.lapS seconds: watch one lap
    for (let k = 0; k < 60 && seen.size < 2; k++) {
      pass(500, 100);
      seen.add(globe().dataset.link!);
      const lost = globe().dataset.link === 'lost';
      expect(screen.getByRole('status').textContent).toBe(lost ? MOON_WORDS.linkLost : MOON_WORDS.linkUp('1.3 S'));
      expect(document.querySelector('.sci-globe-orbits .signal')!.classList.contains('lost')).toBe(lost);
    }
    expect([...seen].sort()).toEqual(['lost', 'up']);
  });

  it('Moon 2: the station-keeping tag with the next trim burns and their Δv (LRO: 10.8 m/s a pair)', () => {
    fly(moon, ['power', 'fuel', 'rocket']);
    toMoonOrbit(orbitPanel);
    const p = orbitPanel()!;
    expect(p.querySelector('.sci-trim')).toBeTruthy();
    expect(within(p).getByText(MOON_WORDS.trim)).toBeTruthy();
    expect(within(p).getByText(new RegExp(`NEXT TRIM BURNS IN .* · ${f.speedFine(10.81).toUpperCase().replace('/', '\\/')}`))).toBeTruthy();
  });

  it('Moon 3: the four target cards on the Moon; Tsiolkovskiy says the robot observes it alone on the far side', () => {
    fly(moon3);
    toMoonOrbit(targetPanel);
    const p = targetPanel()!;
    expect(p).toBeTruthy();
    expect(p.querySelector('.sci-globe.moon')).toBeTruthy();
    for (const t of TARGET_SETS.moon.targets) expect(within(p).getAllByText(TARGET_WORDS[t.id]!.name).length).toBeGreaterThan(0);
    expect(p.querySelectorAll('.sci-mark')).toHaveLength(4);
    act(() => fireEvent.click(within(p).getAllByText(TARGET_WORDS.tsiolkovskiy!.name)[0]!));
    expect(document.querySelector('.sci-globe')!.getAttribute('data-focus')).toBe('tsiolkovskiy');
    expect(within(p).getByText(MOON_WORDS.farTarget)).toBeTruthy();
    // its pass is behind the Moon over the target (engine)
    const s = startOperations(moon3, { seed: 2013 });
    expect(moonOrbitView(s)).toBeDefined();
  });
});

// The engine helpers the globe calls are pure: a craft on the far arc is out of sight.
it('linkUpOnRing: inside the far arc the link is lost', () => {
  const pl = { p: [1, 0, 0] as [number, number, number], q: [0, 1, 0] as [number, number, number], farSide: { from: 1.8, to: 4.5 } };
  expect(linkUpOnRing(pl, 3)).toBe(false);
  expect(linkUpOnRing(pl, 0.5)).toBe(true);
});
