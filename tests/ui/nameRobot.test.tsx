// @vitest-environment jsdom
// Name Your Robot (design screen 00): before the first Cadet mission the robot gets a name, at most twelve safe
// characters, saved as sd.robot. Once named (or skipped) PLAY goes straight to packing.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/ui/App';
import { loadRobotName } from '../../src/ui/saves';
import { cleanRobotName, NAME_WORDS, ROBOT_NAMES, ROBOT_WORDS } from '../../src/ui/sdWords';
import './setup';

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

/** A brand-new player: nothing seen, no name. */
function newPlayer() {
  localStorage.removeItem('sd.seen');
  localStorage.removeItem('sd.robot');
}

const nameBox = () => screen.getByRole('textbox', { name: NAME_WORDS.input }) as HTMLInputElement;
const play = () => fireEvent.click(screen.getByRole('button', { name: /^Play: mission/ }));

describe('cleanRobotName', () => {
  it('keeps capitals, digits, spaces and dashes; no leading space; twelve at most', () => {
    expect(cleanRobotName('  voya <script>')).toBe('VOYA SCRIPT');
    expect(cleanRobotName('kestrel-9!!')).toBe('KESTREL-9');
    expect(cleanRobotName('abcdefghijklmnop')).toBe('ABCDEFGHIJKL');
    expect(cleanRobotName('a   b')).toBe('A B');
  });

  it('a tampered save is cleaned when it is read back', () => {
    localStorage.setItem('sd.robot', JSON.stringify({ name: '<img onerror=x>' }));
    expect(loadRobotName()).toBe('IMG ONERRORX');
  });
});

describe('Name Your Robot', () => {
  it('the first PLAY opens it; LAUNCH saves the name and the first words come back; LOAD goes to packing', () => {
    vi.useFakeTimers();
    newPlayer();
    render(<App />);
    play();
    expect(nameBox()).toBeTruthy();
    const launch = screen.getByRole('button', { name: /LAUNCH INTO TODAY/ });
    expect((launch as HTMLButtonElement).disabled).toBe(true); // no name yet
    fireEvent.change(nameBox(), { target: { value: 'tally ho! 1234567' } });
    expect(nameBox().value).toBe('TALLY HO 123');
    fireEvent.click(screen.getByRole('button', { name: /LAUNCH INTO TODAY/ }));
    expect(JSON.parse(localStorage.getItem('sd.robot')!)).toEqual({ name: 'TALLY HO 123' });
    expect(screen.getByRole('status').textContent).toContain(NAME_WORDS.firstWords);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${NAME_WORDS.load('TALLY HO 123')}`) }));
    pass(100);
    // Packing, with the name on the tag.
    expect((screen.getByLabelText(ROBOT_WORDS.nameLabel) as HTMLInputElement).value).toBe('TALLY HO 123');
    expect(screen.queryByRole('textbox', { name: NAME_WORDS.input })).toBeNull();
  });

  it('a suggestion fills the cells; Enter launches', () => {
    newPlayer();
    render(<App />);
    play();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(NAME_WORDS.suggestions[2]!) }));
    expect(nameBox().value).toBe(NAME_WORDS.suggestions[2]);
    fireEvent.keyDown(nameBox(), { key: 'Enter' });
    expect(loadRobotName()).toBe(NAME_WORDS.suggestions[2]);
  });

  it('SKIP keeps the default name and is not asked again', () => {
    vi.useFakeTimers();
    newPlayer();
    const { unmount } = render(<App />);
    play();
    fireEvent.click(screen.getByRole('button', { name: NAME_WORDS.skip(ROBOT_NAMES[0]!) }));
    pass(100);
    expect(screen.getByLabelText(ROBOT_WORDS.nameLabel)).toBeTruthy();
    expect(loadRobotName()).toBe('');
    unmount();
    render(<App />);
    play();
    pass(100);
    expect(screen.queryByRole('textbox', { name: NAME_WORDS.input })).toBeNull();
    expect(screen.getByLabelText(ROBOT_WORDS.nameLabel)).toBeTruthy();
  });

  it('a robot that already has a name goes straight to packing', () => {
    vi.useFakeTimers();
    newPlayer();
    localStorage.setItem('sd.robot', JSON.stringify({ name: 'NOVA' }));
    render(<App />);
    play();
    pass(100);
    expect(screen.queryByRole('textbox', { name: NAME_WORDS.input })).toBeNull();
  });

  it('◂ BACK returns Home', () => {
    newPlayer();
    render(<App />);
    play();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: /^Play: mission/ })).toBeTruthy();
  });
});
