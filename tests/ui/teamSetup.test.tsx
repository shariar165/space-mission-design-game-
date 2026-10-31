// @vitest-environment jsdom
// Team mode on one shared screen (spec: Team mode; design screens T1 and T2): Home → TEAM → Team Setup (solo or
// team, players, call signs, who holds which role) → Mission Objective (the Flight Director picks, the others agree
// or object, the FD locks or overrules) → Pack, flying the locked objective. Every rule is the engine's.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TEAM_RULES, type RoleId } from '../../src/engine/team/roles';
import { ConflictBanner } from '../../src/ui/components/team/TeamPanels';
import { App } from '../../src/ui/App';
import * as f from '../../src/ui/format';
import { OBJECTIVE_WORDS, QUICK_WORDS, ROLE_WORDS, TEAM_PACK_WORDS, TEAM_WORDS } from '../../src/ui/sdWords';
import './setup';

const SIGNS = TEAM_RULES.callSigns.value;
const btn = (name: string | RegExp) => screen.getByRole('button', { name });

function openTeam() {
  render(<App />);
  fireEvent.click(btn(new RegExp(`^${TEAM_WORDS.menu}: `)));
}

describe('Team Setup (T1)', () => {
  it('Home’s TEAM key opens it: four players, one role each, call signs from the list', () => {
    openTeam();
    expect(btn(f.num(4)).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(TEAM_WORDS.lineTeam(f.num(4)))).toBeTruthy();
    expect(screen.getByText(TEAM_WORDS.oneEach)).toBeTruthy();
    for (const s of SIGNS.slice(0, 4)) expect(btn(TEAM_WORDS.callSignTitle(s))).toBeTruthy();
    const fd = screen.getByRole('region', { name: ROLE_WORDS['flight-director'].name });
    expect(within(fd).getByText(SIGNS[0]!)).toBeTruthy();
    expect(screen.getByText(TEAM_WORDS.nextObjective)).toBeTruthy();
  });

  it('two players: each holds two roles; SOLO holds all four and turns the player keys off', () => {
    openTeam();
    fireEvent.click(btn(f.num(2)));
    expect(screen.getByText(TEAM_WORDS.doubled(`${SIGNS[0]} + ${SIGNS[1]}`, true))).toBeTruthy();
    expect(screen.getAllByText(TEAM_WORDS.roles(f.num(2))).length).toBe(4);
    fireEvent.click(btn(new RegExp(`^${TEAM_WORDS.solo}`)));
    expect(screen.getByText(TEAM_WORDS.lineSolo)).toBeTruthy();
    expect(screen.getByText(TEAM_WORDS.soloNoVotes)).toBeTruthy();
    expect((btn(f.num(3)) as HTMLButtonElement).disabled).toBe(true);
    // TEAM goes back to the last team size
    fireEvent.click(btn(new RegExp(`^${TEAM_WORDS.team}`)));
    expect(btn(f.num(2)).getAttribute('aria-pressed')).toBe('true');
  });

  it('HELD BY hands a role on; a player left with no role is named and NEXT waits; the crew is saved', () => {
    openTeam();
    fireEvent.click(btn(TEAM_WORDS.handOn(ROLE_WORDS['comms-ops'].name, SIGNS[3]!)));
    expect(screen.getByText(TEAM_WORDS.idle(SIGNS[3]!))).toBeTruthy();
    expect((btn(TEAM_WORDS.next) as HTMLButtonElement).disabled).toBe(true);
    const saved = JSON.parse(localStorage.getItem('sd.team')!) as { seats: { roles: string[] }[] };
    expect(saved.seats[0]!.roles).toEqual(['flight-director', 'comms-ops']);
    // a call sign steps to the next free one
    fireEvent.click(btn(TEAM_WORDS.callSignTitle(SIGNS[0]!)));
    expect(btn(TEAM_WORDS.callSignTitle(SIGNS[4]!))).toBeTruthy();
  });

  it('the online room is not here yet: its key is off', () => {
    openTeam();
    expect((btn(new RegExp(`^${TEAM_WORDS.online}`)) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Mission Objective (T2)', () => {
  const vote = (role: keyof typeof ROLE_WORDS, word: string) => fireEvent.click(btn(OBJECTIVE_WORDS.voteTitle(ROLE_WORDS[role].name, word)));

  it('the FD picks; an objection waits, then OVERRULE locks it; NEXT · PACK packs with the objective', () => {
    openTeam();
    fireEvent.click(btn(TEAM_WORDS.next));
    expect(screen.getByText(OBJECTIVE_WORDS.msgPick)).toBeTruthy();
    expect((btn(OBJECTIVE_WORDS.lock) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn(new RegExp(OBJECTIVE_WORDS.objectives.moons.title)));
    expect(screen.getByText(OBJECTIVE_WORDS.stampPick)).toBeTruthy();
    expect(screen.getByText(OBJECTIVE_WORDS.msgWait(f.num(3), false))).toBeTruthy();
    vote('spacecraft-engineer', OBJECTIVE_WORDS.agree);
    vote('science-lead', OBJECTIVE_WORDS.object);
    expect(screen.getByText(OBJECTIVE_WORDS.msgObject(ROLE_WORDS['science-lead'].short, true))).toBeTruthy();
    expect((btn(OBJECTIVE_WORDS.waiting) as HTMLButtonElement).disabled).toBe(true);
    vote('comms-ops', OBJECTIVE_WORDS.agree);
    fireEvent.click(btn(OBJECTIVE_WORDS.overrule));
    expect(screen.getByText(OBJECTIVE_WORDS.msgOverruled(OBJECTIVE_WORDS.objectives.moons.title))).toBeTruthy();
    expect(screen.getByText(OBJECTIVE_WORDS.stampLocked)).toBeTruthy();
    // locked: the other cards are off
    expect((btn(new RegExp(OBJECTIVE_WORDS.objectives.surface.title)) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn(OBJECTIVE_WORDS.nextPack));
    expect(document.querySelector('.pk, .sd-pack, [class*="pk-"]')).toBeTruthy();
  });

  it('every voice agreeing: LOCK OBJECTIVE; a re-pick clears the voices', () => {
    openTeam();
    fireEvent.click(btn(TEAM_WORDS.next));
    fireEvent.click(btn(new RegExp(OBJECTIVE_WORDS.objectives.atmosphere.title)));
    vote('spacecraft-engineer', OBJECTIVE_WORDS.object);
    fireEvent.click(btn(new RegExp(OBJECTIVE_WORDS.objectives.surface.title)));
    expect(screen.getByText(OBJECTIVE_WORDS.msgWait(f.num(3), false))).toBeTruthy();
    for (const r of ['spacecraft-engineer', 'science-lead', 'comms-ops'] as const) vote(r, OBJECTIVE_WORDS.agree);
    expect(screen.getByText(OBJECTIVE_WORDS.msgAll)).toBeTruthy();
    fireEvent.click(btn(OBJECTIVE_WORDS.lock));
    expect(screen.getByText(OBJECTIVE_WORDS.msgLocked(OBJECTIVE_WORDS.objectives.surface.title))).toBeTruthy();
  });

  it('solo: every other role is the same player, so a pick can be locked at once', () => {
    openTeam();
    fireEvent.click(btn(new RegExp(`^${TEAM_WORDS.solo}`)));
    fireEvent.click(btn(TEAM_WORDS.next));
    expect(screen.getAllByText(OBJECTIVE_WORDS.auto).length).toBe(3);
    fireEvent.click(btn(new RegExp(OBJECTIVE_WORDS.objectives.surface.title)));
    expect(screen.getByText(OBJECTIVE_WORDS.msgAll)).toBeTruthy();
    fireEvent.click(btn(OBJECTIVE_WORDS.lock));
    expect(btn(OBJECTIVE_WORDS.nextPack)).toBeTruthy();
  });

  it('the cards show each target’s share of the science and the parts that count', () => {
    openTeam();
    fireEvent.click(btn(TEAM_WORDS.next));
    const card = btn(new RegExp(OBJECTIVE_WORDS.objectives.atmosphere.title));
    expect(card.textContent).toContain(OBJECTIVE_WORDS.share(f.pct(0.6, 0)));
    expect(card.textContent).toContain(OBJECTIVE_WORDS.hardest(OBJECTIVE_WORDS.why.drag));
    expect(card.textContent).toContain(ROLE_WORDS['science-lead'].name);
  });
});

describe('Team Pack (T3)', () => {
  /** Home → TEAM → objective locked (solo-fast: all agree) → the team's Pack. */
  function toPack() {
    openTeam();
    fireEvent.click(btn(TEAM_WORDS.next));
    fireEvent.click(btn(new RegExp(OBJECTIVE_WORDS.objectives.surface.title)));
    for (const r of ['spacecraft-engineer', 'science-lead', 'comms-ops'] as const)
      fireEvent.click(btn(OBJECTIVE_WORDS.voteTitle(ROLE_WORDS[r].name, OBJECTIVE_WORDS.agree)));
    fireEvent.click(btn(OBJECTIVE_WORDS.lock));
    fireEvent.click(btn(OBJECTIVE_WORDS.nextPack));
  }

  it('the shelf is grouped by role; SHARED LIMITS lists every role; the kicker names the objective', () => {
    toPack();
    for (const r of Object.keys(ROLE_WORDS) as (keyof typeof ROLE_WORDS)[]) expect(screen.getByRole('group', { name: ROLE_WORDS[r].name })).toBeTruthy();
    const limits = screen.getByRole('region', { name: TEAM_PACK_WORDS.limits });
    expect(within(limits).getByText(TEAM_PACK_WORDS.colShare)).toBeTruthy();
    expect(screen.getByText(TEAM_PACK_WORDS.kicker(OBJECTIVE_WORDS.objectives.surface.title))).toBeTruthy();
  });

  it('packing is a team log entry made as the part’s role: the camera lands in the Science Lead’s colour', () => {
    toPack();
    const sci = screen.getByRole('group', { name: ROLE_WORDS['science-lead'].name });
    const before = document.querySelectorAll('.pk-part.tm-r-science-lead').length;
    const fits = within(sci).getAllByRole('button').filter((b) => !b.getAttribute('aria-label')!.includes('(no room)'));
    expect(fits.length).toBeGreaterThan(0);
    fireEvent.click(fits[0]!);
    expect(document.querySelectorAll('.pk-part.tm-r-science-lead').length).toBe(before + 1);
  });

  it('quick messages only: SPEAKING AS picks the role, the TEAM LINE shows what it said', () => {
    toPack();
    fireEvent.click(btn(TEAM_PACK_WORDS.speakAs(ROLE_WORDS['spacecraft-engineer'].name)));
    fireEvent.click(btn(QUICK_WORDS['need-power']!));
    const line = screen.getByRole('region', { name: TEAM_PACK_WORDS.line });
    expect(within(line).getByLabelText(TEAM_PACK_WORDS.say(ROLE_WORDS['spacecraft-engineer'].name, QUICK_WORDS['need-power']!))).toBeTruthy();
    expect(within(line).getByText(TEAM_PACK_WORDS.msgs(f.num(1)))).toBeTruthy();
    // nowhere to type
    expect(document.querySelector('input[type="text"], textarea')).toBeNull();
  });
});

describe('the conflict banner (T3)', () => {
  const role = (mass_kg: number, cost_M: number) => ({ mass_kg, cost_M, squares: 0 });
  const spend = {
    roles: { 'flight-director': role(600, 180), 'spacecraft-engineer': role(2500, 40), 'science-lead': role(300, 100), 'comms-ops': role(100, 20) },
    limits: { mass_kg: 3400, cost_M: 500, squares: 36 },
    over: { mass: ['spacecraft-engineer', 'science-lead'] as RoleId[] },
  };

  it('over the mass: by how much (3,500 − 3,400 = 100 kg) and the roles that have to talk', () => {
    render(<ConflictBanner spend={spend} />);
    const b = screen.getByRole('alert');
    expect(b.textContent).toContain(TEAM_PACK_WORDS.over.mass);
    expect(b.textContent).toContain(TEAM_PACK_WORDS.overBy(f.kg(100)));
    expect(b.textContent).toContain(ROLE_WORDS['spacecraft-engineer'].name);
    expect(b.textContent).toContain(ROLE_WORDS['science-lead'].name);
  });

  it('under every limit and room for everything: no banner', () => {
    render(<ConflictBanner spend={{ ...spend, over: {} }} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
