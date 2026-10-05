// @vitest-environment jsdom
// The crew file: the rank plate on Home (engine rankFor / starTotals), the panel with the real job and every badge
// (engine badges), and the report's promotion.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { presetDesign } from '../../src/engine/missions';
import { runOperations } from '../../src/engine/ops/index';
import { BADGES, RANKS } from '../../src/engine/ranks';
import { App } from '../../src/ui/App';
import { MissionReport } from '../../src/ui/screens/MissionReport';
import { BADGE_WORDS, CREW_WORDS, RANK_WORDS } from '../../src/ui/sdWords';
import './setup';

describe('Home: the crew file', () => {
  it('three stars make a flight controller, five more to CAPCOM; the panel lists every badge', () => {
    localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 2, 'moon-2': 1, 'rescue-mco': 3 }));
    render(<App />);
    const plate = screen.getByRole('button', { name: `${CREW_WORDS.open}: ${RANK_WORDS['flight-controller']}` });
    // 2 + 1 = 3 level stars (the rescue's stars are not level stars); CAPCOM needs 8 → 5 to go
    expect(plate.textContent).toContain(CREW_WORDS.toNext(5, RANK_WORDS.capcom!));
    fireEvent.click(plate);
    const panel = screen.getByRole('dialog', { name: CREW_WORDS.title });
    expect(within(panel).getByText(RANKS[1]!.job.value)).toBeTruthy();
    const items = within(panel).getAllByRole('listitem');
    expect(items.length).toBe(BADGES.length);
    expect(within(panel).getByLabelText(`${BADGE_WORDS['first-flight']!.name}: ${CREW_WORDS.earned}`)).toBeTruthy();
    expect(within(panel).getByLabelText(`${BADGE_WORDS.rescuer!.name}: ${CREW_WORDS.earned}`)).toBeTruthy();
    expect(within(panel).getByLabelText(`${BADGE_WORDS['storm-survivor']!.name}: ${CREW_WORDS.locked}`)).toBeTruthy();
  });

  it('a new player is a cadet', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: `${CREW_WORDS.open}: ${RANK_WORDS.cadet}` })).toBeTruthy();
  });
});

describe('Mission Report: promotion', () => {
  it('a new rank and new badges are announced', () => {
    const maven = presetDesign('maven');
    const s = runOperations(maven, { rng: () => 0.999999 }).state;
    render(
      <MissionReport
        state={s}
        design={maven}
        mode="cadet"
        onMode={vi.fn()}
        missionName="Orbiter-1"
        onFlyAgain={vi.fn()}
        onHome={vi.fn()}
        homeLabel="HOME"
        promotion={{ rank: RANKS[1]!, badges: ['night-shift'] }}
      />,
    );
    const promo = screen.getByRole('region', { name: CREW_WORDS.title });
    expect(promo.textContent).toContain(CREW_WORDS.promoted);
    expect(promo.textContent).toContain(RANK_WORDS['flight-controller']);
    expect(promo.textContent).toContain(BADGE_WORDS['night-shift']!.name);
  });

  it('nothing new: no promotion section', () => {
    const maven = presetDesign('maven');
    const s = runOperations(maven, { rng: () => 0.999999 }).state;
    render(<MissionReport state={s} design={maven} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onFlyAgain={vi.fn()} onHome={vi.fn()} homeLabel="HOME" promotion={{ badges: [] }} />);
    expect(screen.queryByRole('region', { name: CREW_WORDS.title })).toBeNull();
  });
});
