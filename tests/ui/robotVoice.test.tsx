// @vitest-environment jsdom
// Name your robot (Pack) and hear it talk (Fly & Survive, Mission Report). The words are sdWords ROBOT_VOICE; the
// messages and their light-time delays are the engine's (heardMessages).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { presetDesign } from '../../src/engine/missions';
import { runOperations } from '../../src/engine/ops/index';
import { finalTransmission } from '../../src/engine/ops/report';
import { App } from '../../src/ui/App';
import * as f from '../../src/ui/format';
import { FlyAndSurvive } from '../../src/ui/screens/FlyAndSurvive';
import { MissionReport } from '../../src/ui/screens/MissionReport';
import { ALBUM, FINAL_WORDS, finalLines, ROBOT_NAMES, ROBOT_WORDS, TX_WORDS } from '../../src/ui/sdWords';
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
    expect(input.value).toBe('ROVER-7 THE '); // at most twelve characters, "!" dropped
    expect(JSON.parse(localStorage.getItem('sd.robot')!)).toEqual({ name: 'ROVER-7 THE ' });
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
  it('its name is over it on the map, and its first message prints on the teletype with how long it took', () => {
    vi.useFakeTimers();
    render(<FlyAndSurvive design={maven} seed={2013} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onHome={vi.fn()} onDone={vi.fn()} robotName="ZED" />);
    pass(100);
    expect(document.querySelector('.crt-you')!.textContent).toBe('ZED');
    fireEvent.click(screen.getByRole('button', { name: '10× speed' }));
    pass(1500, 100);
    // The transmissions teletype: the launch line, printed once it reached Earth, with how long it took.
    const log = screen.getByRole('log', { name: TX_WORDS.logLabel });
    expect(log.textContent).toContain('LIFTOFF. SYSTEMS ON. NEXT STOP: MARS.');
    expect(log.textContent).toContain('ZED · DAY');
    // Launched from Earth: the first words still cross no distance at all.
    expect(log.textContent).toContain(TX_WORDS.noDelay);
  });
});

describe('Mission Report: the final transmission', () => {
  it('a finished flight: the robot’s last message prints line by line, with how long it took to arrive', () => {
    const s = runOperations(maven, { rng: () => 0.999999 }).state;
    const ft = finalTransmission(s)!;
    render(<MissionReport state={s} design={maven} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onFlyAgain={vi.fn()} onHome={vi.fn()} homeLabel="HOME" robotName="ZED" />);
    fireEvent.click(screen.getByRole('button', { name: ALBUM.feed })); // the album comes first at Mars
    const sheet = screen.getByRole('region', { name: FINAL_WORDS.label });
    expect(sheet.textContent).toContain(FINAL_WORDS.title('ZED'));
    expect(sheet.textContent).toContain(FINAL_WORDS.sent(f.durationWords(ft.delay_s)));
    for (const line of finalLines(ft, { dest: 'Mars', name: 'ZED', title: (t) => t, label: (_t, o) => o })) if (!line.includes('{')) expect(sheet.textContent).toContain(line.slice(0, 12));
    expect(sheet.textContent).toContain('PRIMARY MISSION COMPLETE. ZED OUT.');
  });

  it('a lost robot: the last line breaks off, then SIGNAL LOST, citing Opportunity (ⓘ)', () => {
    vi.useFakeTimers();
    const s = runOperations(maven, { seed: 6, policy: 'default' }).state;
    render(<MissionReport state={s} design={maven} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onFlyAgain={vi.fn()} onHome={vi.fn()} homeLabel="HOME" />);
    fireEvent.click(screen.getByRole('button', { name: ALBUM.feed })); // the album comes first at Mars
    const sheet = screen.getByRole('region', { name: FINAL_WORDS.label });
    expect(sheet.textContent).toContain(FINAL_WORDS.cutOff);
    expect(sheet.textContent).not.toContain(FINAL_WORDS.lost); // still printing
    pass(12_000, 33); // one character per 33 ms tick
    expect(sheet.textContent).toContain(FINAL_WORDS.lost);
    expect(sheet.querySelector('.ft-lost button')).not.toBeNull();
    expect(screen.queryByRole('note', { name: ROBOT_WORDS.lastMessage(ROBOT_NAMES[0]!) })).toBeNull();
  });
});
