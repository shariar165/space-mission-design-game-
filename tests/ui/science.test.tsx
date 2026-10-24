// @vitest-environment jsdom
// Science Targets and the DOWNLINK drawer (spec: UI rules 39–40). After arrival at Mars the robot asks what to look
// at, the CRT turns to the targets, OBSERVE sends a light-delayed order, and the picture comes home through the
// drawer with its NASA credit. jsdom has no WebGL or canvas, so the flat globe draws nothing and the markers stay.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { presetDesign } from '../../src/engine/missions';
import { targetById } from '../../src/engine/targets';
import { FlyAndSurvive } from '../../src/ui/screens/FlyAndSurvive';
import { ZOOM_MS } from '../../src/ui/components/fly/arrivalZoom';
import { DOWNLINK, SCIENCE, TARGET_WORDS } from '../../src/ui/sdWords';
import './setup';

const maven = presetDesign('maven');

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

function fly() {
  vi.useFakeTimers();
  render(<FlyAndSurvive design={maven} seed={2013} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onHome={vi.fn()} onDone={vi.fn()} robotName="VOYA" />);
  pass(100);
}

const panel = () => screen.queryByRole('region', { name: SCIENCE.title('MARS') });

/** Next event until the robot's question arrives and the targets open; danger cards are left to the robot. */
function toMarsOrbit() {
  toMarsOrbitNoWait();
  pass(ZOOM_MS + 200); // the map zooms into the globe (spec: UI rule 42); the keys wait for it
}

function toMarsOrbitNoWait() {
  for (let i = 0; i < 300 && !panel(); i++) {
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
}

describe('Science Targets in Mars orbit', () => {
  it('the robot asks, the CRT turns to Mars with six targets, and the clock holds', () => {
    fly();
    toMarsOrbit();
    const p = panel()!;
    expect(p).toBeTruthy();
    for (const w of Object.values(TARGET_WORDS)) expect(within(p).getAllByText(w.name).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/VOYA IS IN MARS ORBIT. WHAT SHOULD IT LOOK AT\?/).length).toBeGreaterThan(0);
    // The lesson on each card is the NASA caption's line (Sourced).
    expect(within(p).getByText(targetById('olympus-mons')!.learn.value)).toBeTruthy();
    // Held: the speed keys cannot start the clock.
    expect((screen.getByRole('button', { name: '100× speed' }) as HTMLButtonElement).disabled).toBe(true);
  }, 120_000);

  it('OBSERVE sends a light-delayed order; DONE resumes; the picture comes home through the DOWNLINK drawer', () => {
    fly();
    toMarsOrbit();
    const p = panel()!;
    fireEvent.click(within(p).getAllByRole('button', { name: /VALLES MARINERIS/ })[0]!);
    fireEvent.click(within(p).getByRole('button', { name: `${SCIENCE.observe}: VALLES MARINERIS` }));
    // The order is on the teletype, in flight.
    expect(screen.getAllByText(/OBSERVE VALLES MARINERIS/).length).toBeGreaterThan(0);
    fireEvent.click(within(p).getByRole('button', { name: `${SCIENCE.done} ▸` }));
    pass(ZOOM_MS + 200); // the globe zooms back out to the map (spec: UI rule 42)
    expect(panel()).toBeNull();
    // The DOWNLINK key on the paper counts the picture still on the robot.
    expect(screen.getByRole('button', { name: /DOWNLINK/ })).toBeTruthy();
    // Fly on until it is home.
    for (let i = 0; i < 80 && !screen.queryByText(DOWNLINK.allHome('1')); i++) {
      // The robot's reply to the order holds the clock for a moment (no action keys meanwhile).
      const next = screen.queryByRole('button', { name: 'Next event' }) as HTMLButtonElement | null;
      if (next && !next.disabled) act(() => fireEvent.click(next));
      else pass(250, 250);
      const go = screen.queryByRole('button', { name: 'CONTINUE ▸' }) ?? screen.queryByRole('button', { name: /LET THE ROBOT DECIDE/ });
      if (go) act(() => fireEvent.click(go));
    }
    fireEvent.click(screen.getByRole('button', { name: /DOWNLINK/ }));
    const drawer = screen.getByRole('region', { name: DOWNLINK.title });
    expect(within(drawer).getByText(DOWNLINK.bigHome)).toBeTruthy();
    // jsdom has no requestAnimationFrame timing for the print here: the credit line names the NASA image.
    const img = targetById('valles-marineris')!.image;
    expect(within(drawer).getByText(DOWNLINK.credit(img.credit, img.mission, img.nasaId))).toBeTruthy();
    fireEvent.click(within(drawer).getByRole('button', { name: DOWNLINK.closeKey }));
    expect(screen.queryByRole('region', { name: DOWNLINK.title })).toBeNull();
  }, 120_000);
});

const globe = () => document.querySelector<HTMLElement>('.sci-globe')!;
const pickTarget = (name: string) => fireEvent.click(within(panel()!).getAllByRole('button', { name: new RegExp(name) })[0]!);
const observeKey = (name: string) => within(panel()!).getByRole('button', { name: `${SCIENCE.observe}: ${name}` });
const rowState = (name: string) => within(panel()!).getAllByRole('button', { name: new RegExp(name) })[0]!.querySelector('.sci-card-state')?.textContent;

describe('the globe is the hero (spec: UI rules 39 and 41)', () => {
  it('picking a target turns the globe to it and draws its risk: a dip with its drag label, a moon’s orbit change', () => {
    fly();
    toMarsOrbit();
    // After the arrival the globe goes from the overview to the selected target.
    expect(globe().dataset.focus).toBe('olympus-mons');
    // The limb: the ring dips to the deep-dip periapsis, its low arc tinted by the drag-heating risk.
    pickTarget('THIN AIR AT THE LIMB');
    expect(globe().dataset.focus).toBe('limb');
    expect(globe().querySelector('.sci-globe-orbits .ghost')).toBeTruthy();
    expect(globe().querySelector('.sci-globe-orbits .drag.high')).toBeTruthy();
    // MAVEN's 150 km periapsis down to the 125 km deep dip (missions.json, targets.json deepDip)
    expect(within(globe()).getByText(SCIENCE.periapsis('150 km', '125 km'))).toBeTruthy();
    expect(within(globe()).getByText(`⚠ ${SCIENCE.risk.high}`)).toBeTruthy();
    // Phobos: the dashed path out to the moon and back; its apoapsis label (6,300 km → 9,375 − 3,396.2 km)
    pickTarget('PHOBOS');
    expect(globe().dataset.focus).toBe('phobos');
    expect(globe().querySelector('.sci-globe-orbits .transfer')).toBeTruthy();
    expect(globe().querySelector('.sci-globe-orbits .drag')).toBeNull();
    expect(within(globe()).getByText(SCIENCE.apoapsis('6,300 km', '5,979 km'))).toBeTruthy();
    // A marker on the globe selects too.
    fireEvent.click(within(globe()).getByRole('button', { name: 'VALLES MARINERIS' }));
    expect(globe().dataset.focus).toBe('valles-marineris');
    expect(within(globe()).getByText(SCIENCE.periapsisNow('150 km'))).toBeTruthy();
  }, 120_000);

  it('OBSERVE plays the order’s trip with the panel open: the orbiter flies over the target, then IMAGE QUEUED; then the clock holds again', () => {
    fly();
    toMarsOrbit();
    pickTarget('VALLES MARINERIS');
    fireEvent.click(observeKey('VALLES MARINERIS'));
    expect(rowState('VALLES MARINERIS')).toBe(SCIENCE.state.ordered);
    // An OBSERVE leaves at once and crosses space: the strip over the globe counts it down.
    expect(screen.getByText(/^ORDER TO VALLES MARINERIS · REACHES VOYA IN /)).toBeTruthy();
    // The light-time trip out plays in 24 clock steps of 250 ms.
    for (let i = 0; i < 80 && !globe().dataset.flyover; i++) pass(250, 50);
    expect(globe().dataset.flyover).toBe('valles-marineris');
    expect(screen.getByText(SCIENCE.scanning('VOYA', 'VALLES MARINERIS'))).toBeTruthy();
    expect(rowState('VALLES MARINERIS')).toBe(SCIENCE.state.observing);
    // The reply crosses back (16 steps): IMAGE QUEUED on the teletype, one light time later.
    for (let i = 0; i < 80 && !screen.queryAllByText(/VALLES MARINERIS IMAGE QUEUED/).length; i++) pass(250, 50);
    expect(screen.getAllByText(/ORDER RECEIVED\. VALLES MARINERIS IMAGE QUEUED\./).length).toBeGreaterThan(0);
    // The panel holds the clock again: the one-day observation does not finish while it stays open.
    pass(6000, 250);
    expect(rowState('VALLES MARINERIS')).toBe(SCIENCE.state.observing);
    expect((screen.getByRole('button', { name: '100× speed' }) as HTMLButtonElement).disabled).toBe(true);
  }, 120_000);

  it('two orders in a row each play their trip and each gets its reply', () => {
    fly();
    toMarsOrbit();
    pickTarget('VALLES MARINERIS');
    fireEvent.click(observeKey('VALLES MARINERIS'));
    pickTarget('PHOBOS');
    fireEvent.click(observeKey('PHOBOS'));
    for (let i = 0; i < 160 && !screen.queryAllByText(/PHOBOS IMAGE QUEUED/).length; i++) pass(250, 50);
    expect(screen.getAllByText(/VALLES MARINERIS IMAGE QUEUED/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PHOBOS IMAGE QUEUED/).length).toBeGreaterThan(0);
    expect(rowState('PHOBOS')).toBe(SCIENCE.state.observing);
  }, 120_000);
});

describe('phone: a full-width globe and a bottom sheet', () => {
  it('the sheet peeks with the selected target, and its handle steps it open and shut', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('max-width'), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    vi.useFakeTimers();
    render(<FlyAndSurvive design={maven} seed={2013} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onHome={vi.fn()} onDone={vi.fn()} robotName="VOYA" />);
    pass(100);
    const phonePanel = () => screen.queryByRole('region', { name: SCIENCE.titlePhone });
    for (let i = 0; i < 300 && !phonePanel(); i++) {
      const go = screen.queryByRole('button', { name: 'CONTINUE ▸' }) ?? screen.queryByRole('button', { name: /LET THE ROBOT DECIDE/ });
      if (go) act(() => fireEvent.click(go));
      else {
        const choice = document.querySelector<HTMLButtonElement>('.dc-choice:not([disabled])');
        const next = screen.queryByRole('button', { name: 'Next event' }) as HTMLButtonElement | null;
        if (choice) act(() => fireEvent.click(choice));
        else if (next && !next.disabled) act(() => fireEvent.click(next));
        else pass(250, 250);
      }
    }
    pass(ZOOM_MS + 200);
    const p = phonePanel()!;
    const sheet = p.querySelector<HTMLElement>('.sci-sheet')!;
    const handle = within(p).getByRole('button', { name: SCIENCE.sheet });
    expect(sheet.dataset.snap).toBe('peek');
    expect(handle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(handle);
    expect(sheet.dataset.snap).toBe('half');
    fireEvent.click(handle);
    expect(sheet.dataset.snap).toBe('full');
    fireEvent.click(handle);
    expect(sheet.dataset.snap).toBe('peek');
    // The keys stay below the sheet; the globe fills the width above it.
    expect(within(p).getByRole('button', { name: /^OBSERVE/ })).toBeTruthy();
    expect(p.querySelector('.sci-stage .sci-globe')).toBeTruthy();
  }, 120_000);
});

describe('the arrival transition (spec: UI rule 42)', () => {
  it('zooms from the map into the globe in about two seconds, then the keys wake up; going back zooms out', () => {
    fly();
    toMarsOrbitNoWait();
    const root = document.querySelector('.fly')!;
    expect(root.classList.contains('zooming')).toBe(true);
    // The keys wait for the transition; the markers come one by one.
    expect((panel()!.querySelector('.sci-done') as HTMLButtonElement).disabled).toBe(true);
    pass(ZOOM_MS + 200);
    expect(root.classList.contains('zooming')).toBe(false);
    expect(panel()!.querySelectorAll('.sci-mark').length).toBe(6);
    fireEvent.click(panel()!.querySelector('.sci-done')!);
    expect(root.classList.contains('zooming')).toBe(true);
    expect(panel()).toBeTruthy();
    pass(ZOOM_MS + 200);
    expect(panel()).toBeNull();
    expect(root.classList.contains('zooming')).toBe(false);
  }, 120_000);
});

describe('reduced motion', () => {
  it('the arrival is an instant cut: no zoom, the keys work at once', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    fly();
    toMarsOrbitNoWait();
    expect(document.querySelector('.fly')!.classList.contains('zooming')).toBe(false);
    expect((panel()!.querySelector('.sci-done') as HTMLButtonElement).disabled).toBe(false);
  }, 120_000);
});
