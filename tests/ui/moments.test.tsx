// @vitest-environment jsdom
// Big moments: the launch countdown (engine countdownAt), the arrival banner (engine momentsSince) and the sound
// toggle. Presentation only: the clock is held while the countdown runs, then the flight goes on as before.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { presetDesign } from '../../src/engine/missions';
import { FlyAndSurvive } from '../../src/ui/screens/FlyAndSurvive';
import { SoundToggle } from '../../src/ui/components/sd/SoundToggle';
import { MOMENT_WORDS, SOUND_WORDS } from '../../src/ui/sdWords';
import './setup';

const maven = presetDesign('maven');

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

function open(extra: Partial<Parameters<typeof FlyAndSurvive>[0]> = {}) {
  vi.useFakeTimers();
  const onLaunchSeen = vi.fn();
  render(<FlyAndSurvive design={maven} seed={2013} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onHome={vi.fn()} onDone={vi.fn()} onLaunchSeen={onLaunchSeen} {...extra} />);
  pass(100);
  return { onLaunchSeen };
}

describe('launch countdown', () => {
  it('T−5 … T−1, LIFTOFF!, then the flight; the clock is held meanwhile', () => {
    const { onLaunchSeen } = open({ launchMoment: true });
    const dlg = screen.getByRole('dialog', { name: MOMENT_WORDS.countdownK });
    expect(dlg.textContent).toContain(MOMENT_WORDS.count(5));
    expect((screen.getByRole('button', { name: '10× speed' }) as HTMLButtonElement).disabled).toBe(true);
    pass(1000);
    expect(dlg.textContent).toContain(MOMENT_WORDS.count(4));
    pass(4100);
    expect(dlg.textContent).toContain(MOMENT_WORDS.liftoff);
    pass(1700);
    expect(screen.queryByRole('dialog', { name: MOMENT_WORDS.countdownK })).toBeNull();
    expect(onLaunchSeen).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button', { name: '10× speed' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('SKIP ends it at once', () => {
    const { onLaunchSeen } = open({ launchMoment: true });
    fireEvent.click(screen.getByRole('button', { name: MOMENT_WORDS.skip }));
    expect(screen.queryByRole('dialog', { name: MOMENT_WORDS.countdownK })).toBeNull();
    expect(onLaunchSeen).toHaveBeenCalledTimes(1);
  });

  it('the first-flight coach waits until the rocket is up', () => {
    open({ launchMoment: true, coach: true });
    expect(document.querySelector('.sd-coach')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: MOMENT_WORDS.skip }));
    expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);
  });

  it('no countdown when the level has flown before', () => {
    open();
    expect(screen.queryByRole('dialog', { name: MOMENT_WORDS.countdownK })).toBeNull();
  });
});

describe('arrival banner', () => {
  it('the arrival burn at Mars: IN ORBIT AT MARS!', () => {
    // Reach the arrival burn the cheap way: jump event to event and let the robot answer each danger card (the clock
    // runs on, so no order animation plays), spending one 100 ms slice per step. Sending orders here played their
    // light-time animations: ~85 steps of 4 slices, each re-rendering the whole flight screen, which ran past the 20 s
    // test timeout under the full parallel suite. Orders and their animations are tested in flyAndSurvive.test.tsx.
    open();
    const banner = () => screen.queryByText(MOMENT_WORDS.arrived('MARS', false));
    let steps = 0;
    for (; steps < 60 && !banner(); steps++) {
      const decide = screen.queryByRole('button', { name: /^LET THE ROBOT DECIDE/ });
      const cont = screen.queryByRole('button', { name: 'CONTINUE ▸' });
      const next = screen.queryByRole('button', { name: 'Next event' }) as HTMLButtonElement | null;
      if (decide) act(() => fireEvent.click(decide));
      else if (cont) act(() => fireEvent.click(cont));
      else if (next && !next.disabled) act(() => fireEvent.click(next));
      pass(100, 100);
    }
    expect(banner()).not.toBeNull();
    // MAVEN, seed 2013: 10 event jumps, 3 cards and their 3 results (measured 16 steps); a guard against creeping back.
    expect(steps).toBeLessThan(30);
  });
});

describe('sound toggle', () => {
  it('turns sound off and on, and remembers it', () => {
    render(<SoundToggle />);
    const b = screen.getByRole('button', { name: SOUND_WORDS.on });
    expect(b.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(b);
    expect(screen.getByRole('button', { name: SOUND_WORDS.off }).getAttribute('aria-pressed')).toBe('false');
    expect(JSON.parse(localStorage.getItem('sd.sound')!)).toEqual({ on: false });
    fireEvent.click(screen.getByRole('button', { name: SOUND_WORDS.off }));
    expect(JSON.parse(localStorage.getItem('sd.sound')!)).toEqual({ on: true });
  });
});
