// @vitest-environment jsdom
// The CRT map's solar storm (user report: on the Moon map the storm seemed to come from Earth). The Sun is drawn
// in its true direction, the storm wave leaves the Sun and reaches the robot at onset, and the order pulse from
// Earth is labelled YOUR ORDER. Geometry comes from the engine (frame.sun, stormFront); the map only scales it.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { flightMap } from '../../src/engine/flightMap';
import { presetDesign } from '../../src/engine/missions';
import { advanceOperations, consoleView, runOperations, startOperations, stormFront, type OpsState } from '../../src/engine/ops/index';
import type { Design } from '../../src/engine/types';
import { CrtMap } from '../../src/ui/components/fly/CrtMap';
import { MAP_CX, MAP_CY, projector } from '../../src/ui/sdGeometry';
import { MAP_WORDS } from '../../src/ui/sdWords';
import { starterDesign } from '../../src/ui/starters';
import './setup';

const moon = starterDesign('moon', '2026-10-04');
const maven = presetDesign('maven');

/** The flight at a share of the way through its first solar storm's warning day (seed 4 draws one on both). */
function midStorm(design: Design, share: number): OpsState {
  const h = runOperations(design, { seed: 4 }).state.hazards.find((x) => x.type === 'solar-storm')!;
  const t = h.knownAt + share * (h.onset - h.knownAt);
  let s = startOperations(design, { seed: 4 });
  for (let i = 0; i < 1000 && s.t < t - 1e-9 && s.status === 'flying'; i++) s = advanceOperations(s, { until: t });
  return s;
}

function draw(s: OpsState, opts: { pulse?: number; phone?: boolean } = {}) {
  const v = consoleView(s);
  const map = flightMap(s.env.design, s.env.ev);
  const storm = stormFront(s);
  render(
    <CrtMap
      map={map}
      frame={v.map.frame}
      trail={v.map.trail}
      ahead={[]}
      destination={s.env.design.destination}
      destName="Moon"
      ringPhase={0}
      {...(storm ? { storm } : {})}
      {...(opts.pulse !== undefined ? { pulse: opts.pulse } : {})}
      phone={opts.phone ?? false}
      lost={false}
    />,
  );
  return { v, map, storm, p: projector(map.extent_m) };
}

const centre = (g: Element) => {
  const c = g.querySelectorAll('circle')[1]!;
  return [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))] as const;
};

describe('CRT map: the Sun and the solar storm', () => {
  it('Moon map: the Sun is drawn on the edge, in its true direction from Earth (not at Earth)', () => {
    const s = advanceOperations(startOperations(moon, { rng: () => 0.999999 }), { until: 20 });
    const { v, p } = draw(s);
    const sun = screen.getByTestId('edge-sun');
    expect(sun.textContent).toContain(MAP_WORDS.sun);
    const [x, y] = centre(sun);
    const far = p.at(v.map.frame.sun);
    // Same direction from the centre (Earth) as the real Sun, about 1 AU away
    const a = Math.atan2(y - MAP_CY, x - MAP_CX);
    const b = Math.atan2(far[1] - MAP_CY, far[0] - MAP_CX);
    expect(Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))).toBeLessThan(1e-3);
    // On the visible map, well away from Earth
    expect(Math.hypot(x - MAP_CX, y - MAP_CY)).toBeGreaterThan(200);
  });

  it('Moon map: halfway through the warning day the wave is halfway from the Sun to the robot', () => {
    const s = midStorm(moon, 0.5);
    const { v, p } = draw(s);
    const wave = screen.getByTestId('storm-wave');
    expect(wave.classList.contains('coming')).toBe(true);
    const [sx, sy] = centre(screen.getByTestId('edge-sun'));
    expect(wave.getAttribute('data-from')).toBe(`${sx.toFixed(0)} ${sy.toFixed(0)}`);
    const front = wave.querySelector('path')!.getAttribute('d')!;
    const [x1, y1, x2, y2] = front.match(/-?\d+(\.\d+)?/g)!.map(Number) as [number, number, number, number];
    const mid = [(x1 + x2) / 2, (y1 + y2) / 2];
    const craft = p.at(v.map.frame.craft);
    const want = [sx + (craft[0] - sx) * 0.5, sy + (craft[1] - sy) * 0.5];
    expect(Math.hypot(mid[0]! - want[0]!, mid[1]! - want[1]!)).toBeLessThan(1);
    // The front is nowhere near where an order starts (Earth, the centre)
    expect(Math.hypot(mid[0]! - MAP_CX, mid[1]! - MAP_CY)).toBeGreaterThan(50);
  });

  it('Mars map: the wave leaves the Sun at the centre; no edge Sun', () => {
    const s = midStorm(maven, 0.5);
    draw(s);
    expect(screen.queryByTestId('edge-sun')).toBeNull();
    expect(screen.getByTestId('storm-wave').getAttribute('data-from')).toBe(`${MAP_CX} ${MAP_CY}`);
  });

  it('at onset the storm is on the robot: it glows with flecks', () => {
    const s = midStorm(moon, 1.05);
    draw(s);
    expect(screen.getByTestId('storm-wave').classList.contains('hitting')).toBe(true);
    expect(document.querySelector('.crt-robot.storm .crt-flecks')).not.toBeNull();
  });

  it('the order pulse from Earth says YOUR ORDER, so it is never mistaken for the storm', () => {
    const s = midStorm(moon, 0.5);
    draw(s, { pulse: 0.4 });
    expect(document.querySelector('.crt-order-label')!.textContent).toBe(MAP_WORDS.order);
  });
});
