// @vitest-environment jsdom
// HOME, DAILY share card and NOTEBOOK (Signal Delay screens 04–06): counts, grid, streak and lessons are engine output.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { dailyGrid, dailyNumber, dailyStreak } from '../../src/engine/daily';
import { presetDesign } from '../../src/engine/missions';
import { emptyFacts, lessonText, NOTEBOOK, notebook } from '../../src/engine/notebook';
import { runOperations } from '../../src/engine/ops/index';
import { App } from '../../src/ui/App';
import * as f from '../../src/ui/format';
import { Daily, shareText } from '../../src/ui/screens/Daily';
import { Notebook } from '../../src/ui/screens/Notebook';
import { LESSON_WORDS } from '../../src/ui/sdWords';
import './setup';

describe('Home', () => {
  it('opens in Cadet mode with PLAY on the next open level and the engine’s counts on the keys', () => {
    localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 1, 'rescue-mco': 2 }));
    render(<App />);
    expect(screen.getByRole('button', { name: `Play: mission ${f.num(2)}, Heavy Lifting` })).toBeTruthy();
    expect(screen.getByText(`${f.num(1)} OF ${f.num(1)}`)).toBeTruthy(); // rescues solved
    // Notebook: finishing Moon 1 and solving the MCO rescue open two lessons
    const open = notebook({ ...emptyFacts(), progress: { 'moon-1': 1, 'rescue-mco': 2 } }).filter((c) => c.open).length;
    expect(screen.getByText(`${f.num(open)} OF ${f.num(NOTEBOOK.length)}`)).toBeTruthy();
    expect(screen.getByText('NEW TODAY')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Play: mission ${f.num(2)}, Heavy Lifting` }));
    expect(screen.getByRole('group', { name: /Nose:/ })).toBeTruthy();
  });

  it('the Notebook key opens the Notebook; HOME comes back', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^NOTEBOOK/ }));
    expect(screen.getByRole('heading', { name: 'ENGINEER’S NOTEBOOK' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: /SIGNAL/ })).toBeTruthy();
  });
});

describe('Daily share card', () => {
  const s = runOperations(presetDesign('maven'), { seed: 2013, policy: 'safe', extension: 'end' }).state;
  const g = dailyGrid(s);

  it('one row per danger with its result, the streak, and the share text with no choices in it', () => {
    vi.useFakeTimers();
    const played = ['2026-11-09', '2026-11-10'];
    render(<Daily number={dailyNumber('2026-11-10')} date="2026-11-10" grid={g} played={played} mode="cadet" onMode={vi.fn()} onHome={vi.fn()} />);
    expect(within(screen.getByRole('list', { name: 'How each danger went' })).getAllByRole('listitem').length).toBe(g.rows.length);
    expect(screen.getByText(`STREAK ${f.num(dailyStreak(played, '2026-11-10'))}`)).toBeTruthy();
    const text = shareText(dailyNumber('2026-11-10'), g);
    expect(text).toContain(`DAILY #${f.num(dailyNumber('2026-11-10'))}`);
    expect(text).not.toMatch(/SHIELD|KEEP|WAIT|CLIMB/); // no spoilers: never what was picked
    expect(screen.getByText(/NEXT DAILY IN/)).toBeTruthy();
  });
});

describe('Notebook', () => {
  it('open lessons show their words and the Sourced real history with ⓘ; locked ones say how to earn them', () => {
    const facts = { ...emptyFacts(), hazards: { 'solar-storm': 87 } };
    render(<Notebook facts={facts} fresh={['safe-beats-curious']} mode="cadet" onMode={vi.fn()} onHome={vi.fn()} />);
    expect(screen.getByText(`${f.num(1)} OF ${f.num(NOTEBOOK.length)} COLLECTED`)).toBeTruthy();
    const lesson = NOTEBOOK.find((l) => l.id === 'safe-beats-curious')!;
    const detail = within(screen.getByRole('region', { name: 'Lesson' }));
    expect(detail.getByText(LESSON_WORDS['safe-beats-curious']!.title)).toBeTruthy();
    expect(detail.getByText(lessonText(lesson).value)).toBeTruthy();
    expect(detail.getByText(`EARNED · MISSION DAY ${f.num(87)}`)).toBeTruthy();
    expect(screen.getByText('NEW')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Lesson \d+: locked\. Earn a star on First Light/ }));
    expect(detail.getByText('LOCKED')).toBeTruthy();
  });

  it('the category filter dims the other cards', () => {
    render(<Notebook facts={emptyFacts()} fresh={[]} mode="cadet" onMode={vi.fn()} onHome={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'POWER' }));
    const cards = within(screen.getByRole('group', { name: 'Lessons' })).getAllByRole('button');
    const dimmed = cards.filter((c) => c.className.includes('dim')).length;
    expect(dimmed).toBe(NOTEBOOK.filter((l) => l.category !== 'power').length);
  });
});
