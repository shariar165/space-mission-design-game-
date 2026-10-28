// @vitest-environment jsdom
// Where the sounds play (spec UI rule 33), with the fake AudioContext unlocked by a first click: the teletype clacks
// while it types; the CRT hums in flight; a danger card opens with the alert; an order crossing space plays radio
// static, and beeps when it reaches the robot and when the reply reaches Earth; the downlink printer rattles while a
// picture prints. MAVEN, seed 2013 (the engine tests' mission).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { presetDesign } from '../../src/engine/missions';
import type { DownlinkView } from '../../src/engine/ops/index';
import { Downlink } from '../../src/ui/components/fly/Downlink';
import { Teletype } from '../../src/ui/components/sd/Teletype';
import { FlyAndSurvive } from '../../src/ui/screens/FlyAndSurvive';
import { sound } from '../../src/ui/sound';
import { Ctx } from './fakeAudio';
import './setup';

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

beforeAll(() => {
  vi.stubGlobal('AudioContext', Ctx);
  window.dispatchEvent(new Event('pointerdown'));
});

describe('sounds in the game', () => {
  it('the teletype clacks while characters appear, and stops when the line is printed', () => {
    vi.useFakeTimers();
    render(<Teletype text="SIGNAL EXPECTED" />);
    expect(sound.unlocked()).toBe(true);
    expect(sound.playing()).toContain('clack');
    // 15 characters at 34 a second: under half a second
    pass(1000);
    expect(screen.getByText('SIGNAL EXPECTED', { selector: '[aria-hidden] *, [aria-hidden]' })).toBeTruthy();
    expect(sound.playing()).not.toContain('clack');
  });

  it('in flight: the CRT hums; a danger card opens with the alert; the order crosses with static and lands with a beep', () => {
    vi.useFakeTimers();
    const cues = vi.spyOn(sound, 'play');
    render(<FlyAndSurvive design={presetDesign('maven')} seed={2013} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onHome={vi.fn()} onDone={vi.fn()} />);
    pass(100);
    expect(sound.playing()).toContain('hum');
    for (let i = 0; i < 30 && !screen.queryByRole('dialog', { name: /DANGER CARD/ }); i++) act(() => fireEvent.click(screen.getByRole('button', { name: 'Next event' })));
    expect(screen.getByRole('dialog', { name: /DANGER CARD/ })).toBeTruthy();
    expect(cues).toHaveBeenCalledWith('alarm');
    // no order is out yet: no static
    expect(sound.playing()).not.toContain('static');
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
    });
    cues.mockClear();
    let heardStatic = false;
    for (let i = 0; i < 160 && !screen.queryByRole('button', { name: 'CONTINUE ▸' }); i++) {
      pass(250, 250);
      heardStatic ||= sound.playing().includes('static');
    }
    expect(heardStatic).toBe(true);
    // the order reached the robot, then its reply reached Earth: a beep each
    expect(cues.mock.calls.filter((c) => c[0] === 'beep').length).toBeGreaterThanOrEqual(2);
    // the reply is home and the result holds the clock: the static has stopped
    expect(sound.playing()).not.toContain('static');
  }, 60_000);

  it('the downlink printer rattles while a picture prints (not under reduced motion), and stops when the drawer closes', () => {
    const view: DownlinkView = {
      rows: [{ targetId: 'valles-marineris', state: 'home', sent: 1, bits: 1 }],
      waiting: 0,
      home: 1,
      latestHome: { targetId: 'valles-marineris', homeAt: 300, sentAt: 299.99 },
      oneWay_s: 600,
    };
    // jsdom never loads the picture, so the print stays at its first row: printing
    const r = render(<Downlink view={view} robotName="VOYA" phone={false} still={false} onClose={vi.fn()} />);
    expect(sound.playing()).toContain('rattle');
    r.unmount();
    expect(sound.playing()).not.toContain('rattle');
    const still = render(<Downlink view={view} robotName="VOYA" phone={false} still onClose={vi.fn()} />);
    expect(sound.playing()).not.toContain('rattle');
    still.unmount();
  });
});
