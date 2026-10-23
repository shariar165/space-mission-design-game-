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
