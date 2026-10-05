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
    open();
    const banner = () => screen.queryByText(MOMENT_WORDS.arrived('MARS', false));
    for (let i = 0; i < 300 && !banner(); i++) {
      const card = document.querySelector('.dc-choice:not([disabled])');
      const cont = screen.queryByRole('button', { name: 'CONTINUE ▸' });
      const next = screen.queryByRole('button', { name: 'Next event' }) as HTMLButtonElement | null;
      if (card) act(() => fireEvent.click(card));
      else if (cont) act(() => fireEvent.click(cont));
      else if (next && !next.disabled) act(() => fireEvent.click(next));
      pass(400, 100);
    }
    expect(banner()).not.toBeNull();
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
