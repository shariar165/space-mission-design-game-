// @vitest-environment jsdom
// Name your robot (Pack) and hear it talk (Fly & Survive, Mission Report). The words are sdWords ROBOT_VOICE; the
// messages and their light-time delays are the engine's (heardMessages).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { presetDesign } from '../../src/engine/missions';
import { heardMessages, runOperations } from '../../src/engine/ops/index';
import { App } from '../../src/ui/App';
import * as f from '../../src/ui/format';
import { FlyAndSurvive } from '../../src/ui/screens/FlyAndSurvive';
import { MissionReport } from '../../src/ui/screens/MissionReport';
import { ROBOT_NAMES, ROBOT_WORDS, robotSays } from '../../src/ui/sdWords';
import './setup';

const maven = presetDesign('maven');

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

describe('Pack: name your robot', () => {
  it('the name field keeps capitals, letters, digits and dashes, and is saved for next time', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'CHOOSE A MISSION ▸' }));
    fireEvent.click(screen.getByRole('button', { name: /^First Light/ }));
    pass(100);
    const input = screen.getByLabelText(ROBOT_WORDS.nameLabel) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.placeholder).toBe(ROBOT_NAMES[0]);
    fireEvent.change(input, { target: { value: 'rover-7! the brave' } });
    expect(input.value).toBe('ROVER-7 TH'); // at most ten characters, "!" dropped
    expect(JSON.parse(localStorage.getItem('sd.robot')!)).toEqual({ name: 'ROVER-7 TH' });
  });

  it('🎲 suggests the next name on the list', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'CHOOSE A MISSION ▸' }));
    fireEvent.click(screen.getByRole('button', { name: /^First Light/ }));
    pass(100);
    fireEvent.click(screen.getByRole('button', { name: ROBOT_WORDS.suggest }));
    expect((screen.getByLabelText(ROBOT_WORDS.nameLabel) as HTMLInputElement).value).toBe(ROBOT_NAMES[1]);
  });
});

describe('Fly & Survive: the robot talks', () => {
  it('its name is over it on the map, and its first message arrives with how long it took', () => {
    vi.useFakeTimers();
    render(<FlyAndSurvive design={maven} seed={2013} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onHome={vi.fn()} onDone={vi.fn()} robotName="ZED" />);
    pass(100);
    expect(document.querySelector('.crt-you')!.textContent).toBe('ZED');
    fireEvent.click(screen.getByRole('button', { name: '10× speed' }));
    pass(1500, 100);
    const radio = screen.getByRole('log', { name: ROBOT_WORDS.radio('ZED') });
    expect(radio.textContent).toContain('Liftoff!');
    expect(radio.textContent).toContain('FROM MARS · TOOK');
  });
});

describe('Mission Report: the last message', () => {
  it('a finished flight shows the robot’s last message in its words, with the light time it took', () => {
    const s = runOperations(maven, { rng: () => 0.999999 }).state;
    const last = heardMessages(s).latest!;
    render(<MissionReport state={s} design={maven} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onFlyAgain={vi.fn()} onHome={vi.fn()} homeLabel="HOME" robotName="ZED" />);
    const note = screen.getByRole('note', { name: ROBOT_WORDS.lastMessage('ZED') });
    expect(note.textContent).toContain(robotSays(last, 'Mars'));
    expect(note.textContent).toContain(ROBOT_WORDS.took('MARS', f.durationWords(last.delay_s)));
  });

  it('a lost robot’s last words cite Opportunity (ⓘ)', () => {
    const s = runOperations(maven, { seed: 6, policy: 'default' }).state;
    render(<MissionReport state={s} design={maven} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onFlyAgain={vi.fn()} onHome={vi.fn()} homeLabel="HOME" />);
    const note = screen.getByRole('note', { name: ROBOT_WORDS.lastMessage(ROBOT_NAMES[0]!) });
    expect(note.textContent).toContain('battery is low');
    expect(note.querySelector('button')).not.toBeNull();
  });
});
