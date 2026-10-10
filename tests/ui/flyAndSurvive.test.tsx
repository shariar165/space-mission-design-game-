// @vitest-environment jsdom
// FLY & SURVIVE (Signal Delay screen 01): the Mission operations engine flies the craft; every number on screen is
// consoleView / flyTiles / flyCard / comingUp output, formatted. MAVEN, seed 2013 (the engine tests' mission).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { presetDesign } from '../../src/engine/missions';
import { advanceOperations, comingUp, consoleView, flyCard, flyTiles, startOperations } from '../../src/engine/ops/index';
import type { Mode } from '../../src/ui/components/sd/ModeLever';
import * as f from '../../src/ui/format';
import { FlyAndSurvive } from '../../src/ui/screens/FlyAndSurvive';
import { readSnapshot, realStorms, stormSourced } from '../../src/engine/spaceWeather';
import { LIVE_WEATHER } from '../../src/ui/sdWords';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import './setup';

const maven = presetDesign('maven');

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

function open(mode: Mode = 'cadet') {
  vi.useFakeTimers();
  const onDone = vi.fn();
  const onMode = vi.fn();
  render(<FlyAndSurvive design={maven} seed={2013} mode={mode} onMode={onMode} missionName="Orbiter-1" onHome={vi.fn()} onDone={onDone} />);
  pass(100); // the mission is prepared one tick after the loader paints
  return { onDone, onMode };
}

const toDanger = () => {
  for (let i = 0; i < 30 && !screen.queryByRole('dialog', { name: /DANGER CARD/ }); i++) act(() => fireEvent.click(screen.getByRole('button', { name: 'Next event' })));
  return screen.getByRole('dialog', { name: /DANGER CARD/ });
};

describe('Fly & Survive: tiles, clock and ribbon', () => {
  it('opens on day 000 with the four five-segment tiles of flyTiles, and the speed keys run the clock', () => {
    open();
    const s = startOperations(maven, { seed: 2013 });
    const t = flyTiles(s, consoleView(s));
    expect(document.querySelector('.ops-day-num')!.textContent).toBe(f.dayPad(0));
    const tiles = screen.getByRole('list', { name: 'Robot resources' });
    expect(within(tiles).getByRole('listitem', { name: `POWER: ${f.num(t.power.segments)} of 5` })).toBeTruthy();
    expect(within(tiles).getByRole('listitem', { name: `FUEL: ${f.num(t.fuel.segments)} of 5` })).toBeTruthy();
    expect(within(tiles).getByRole('listitem', { name: `DATA: ${f.num(t.data.segments)} of 5` })).toBeTruthy();
    expect(within(tiles).getByRole('listitem', { name: `SYSTEMS: ${f.num(5)} of ${f.num(5)}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '100× speed' }));
    pass(3000, 250); // 100 mission days a real minute → 3 s ≈ 5 days
    const day = Number(document.querySelector('.ops-day-num')!.textContent);
    expect(day).toBeGreaterThanOrEqual(3);
    expect(day).toBeLessThanOrEqual(6);
  });

  it('the Coming Up ribbon lists the engine’s foreseeable events with "IN n DAYS"', () => {
    open();
    const c = comingUp(startOperations(maven, { seed: 2013 }));
    expect(c.items.length).toBeGreaterThan(0);
    for (const it of c.items) expect(screen.getAllByText(`IN ${f.num(it.inDays)} DAYS`).length).toBeGreaterThan(0);
    expect(screen.getByText(`NEXT ${f.num(c.months)} MONTHS`)).toBeTruthy();
  });

  it('labels the real mission’s ghost path as turned to start beside you', () => {
    open();
    expect(screen.getByText(/MAVEN \(2013–2025\): real path, turned to start beside you/)).toBeTruthy();
  });
});

describe('Fly & Survive: danger card', () => {
  it('a danger card stops time and shows the engine’s hazard, times and choices', () => {
    open();
    const card = toDanger();
    const at = advanceOperations(startOperations(maven, { seed: 2013 }));
    const v = consoleView(at);
    const c = flyCard(at, v)!;
    expect(within(card).getByRole('heading').textContent).toBe(v.alert!.title.toUpperCase());
    expect(within(card).getByText('TO VERIFY')).toBeTruthy();
    expect(within(card).getByText(f.durationWords(v.alert!.oneWay_s))).toBeTruthy();
    expect(within(card).getByText(c.onsetIn_s < 60 ? 'NOW' : `IN ${f.durationWords(c.onsetIn_s)}`)).toBeTruthy();
    // time is locked while the card waits
    expect(screen.getByRole('button', { name: '100× speed' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getAllByRole('button', { name: /:/ }).filter((b) => b.classList.contains('dc-choice')).length).toBe(c.options.length);
  });

  it('a risk increase reads "⚠ +n risk", never a negative number', () => {
    open();
    const card = toDanger();
    const at = advanceOperations(startOperations(maven, { seed: 2013 }));
    const c = flyCard(at, consoleView(at))!;
    for (const o of c.options.filter((x) => x.riskIncrease > 0)) expect(within(card.parentElement!.parentElement!).getAllByText(`⚠ +${f.num(o.riskIncrease)} risk`).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/[−-]\s?\d+\s?risk/i);
  });

  it('choosing with ← sends the order: the signal counts down, then the result teletype and CONTINUE', () => {
    const { onDone } = open();
    toDanger();
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
    });
    expect(screen.queryByRole('dialog', { name: /DANGER CARD/ })).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
    const first = document.querySelector('.fly-countdown')!.textContent!;
    pass(1000, 250);
    expect(document.querySelector('.fly-countdown')?.textContent).not.toBe(first); // it counts down (or the next stage began)
    for (let i = 0; i < 120 && !screen.queryByRole('button', { name: 'CONTINUE ▸' }); i++) pass(250, 250);
    const incoming = screen.getByRole('dialog', { name: 'Incoming message' });
    expect(within(incoming).getByText(/ORDER CARRIED OUT|THE ROBOT CHOSE|STANDING ORDER/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE ▸' }));
    expect(screen.queryByRole('dialog', { name: 'Incoming message' })).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('Fly & Survive: Engineer mode', () => {
  it('shows r, d and t = d / c from the console clock, and the tile units', () => {
    open('engineer');
    const s = startOperations(maven, { seed: 2013 });
    const v = consoleView(s);
    expect(screen.getByText(`SUN DIST r = ${f.au(v.clock.sunDistance_m)}`)).toBeTruthy();
    expect(screen.getByText(`EARTH DIST d = ${f.au(v.clock.earthDistance_m)}`)).toBeTruthy();
    expect(document.querySelector('.ops-met')!.textContent).toBe(`LIGHT TIME t = d / c = ${f.mmss(v.clock.oneWay_s)}`);
    expect(screen.getByText(f.kg(flyTiles(s, v).fuel.propellantLeft_kg))).toBeTruthy();
  });

  it('the EQUATIONS drawer shows each gauge’s equation and the ⓘ of its inputs', () => {
    open('engineer');
    const v = consoleView(startOperations(maven, { seed: 2013 }));
    fireEvent.click(screen.getByRole('button', { name: 'EQUATIONS' }));
    const eqs = [...document.querySelectorAll('.ops-eq')].map((e) => e.textContent);
    expect(eqs).toContain(v.gauges.power.equation);
    expect(eqs).toContain(v.gauges.fuel.equation);
    expect(screen.getAllByRole('button', { name: /^Source of / }).length).toBeGreaterThan(8);
  });
});

describe('Fly & Survive: a live Daily’s real CME (spec UI rule 37)', () => {
  it('the danger card names the real DONKI event and its flare; ⓘ links the record and the WSA-ENLIL prediction', () => {
    // vitest runs from the project root. The CME is moved to the start of the week, so it strikes first.
    const sample = readSnapshot(readFileSync(join(process.cwd(), 'tests/fixtures/donki/documented-format-sample.json'), 'utf8'))!;
    const storm = { ...realStorms(sample)[0]!, windowFraction: 0 };
    expect(storm.kind).toBe('cme');
    vi.useFakeTimers();
    render(<FlyAndSurvive design={maven} seed={2013} storms={[storm]} mode="cadet" onMode={vi.fn()} missionName="Daily mission" onHome={vi.fn()} onDone={vi.fn()} />);
    pass(100);
    const card = toDanger();
    expect(card.getAttribute('aria-label')).toMatch(/REAL SUN/);
    expect(within(card).getByText(LIVE_WEATHER.realEvent)).toBeTruthy();
    const src = stormSourced(storm);
    expect(within(card).getByText(src.value)).toBeTruthy();
    expect(within(card).getByText(new RegExp(LIVE_WEATHER.fromFlare('X2.1').replace('.', '\\.')))).toBeTruthy();
    expect(within(card).getByText(`DANGER ARRIVES · ${LIVE_WEATHER.severity.direct}`)).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: `Source of ${LIVE_WEATHER.realEvent.toLowerCase()}` }));
    expect(screen.getByRole('link', { name: /Open source/ }).getAttribute('href')).toBe(storm.link);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(within(card).getByRole('button', { name: `Source of danger arrives · ${LIVE_WEATHER.severity.direct.toLowerCase()}` }));
    expect(screen.getByText(/NASA WSA-ENLIL model prediction/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open source/ }).getAttribute('href')).toBe(storm.arrival!.link);
  });
});
