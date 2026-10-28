// @vitest-environment jsdom
// EN / বাংলা (spec UI rule 48): the switch sits in the top bar, turns the words to Bangla at once, is remembered in
// the browser, and never restarts what is on screen: a flight keeps its clock. Numbers stay the same.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { presetDesign } from '../../src/engine/missions';
import { App } from '../../src/ui/App';
import { lang, useLang } from '../../src/ui/lang';
import { FlyAndSurvive } from '../../src/ui/screens/FlyAndSurvive';
import './setup';

const maven = presetDesign('maven');
const onMode = vi.fn();
const onHome = vi.fn();
const onDone = vi.fn();

/** As App does: the screen re-renders when the language changes (with the same design and handlers). */
function Flight() {
  useLang();
  return <FlyAndSurvive design={maven} seed={2013} mode="cadet" onMode={onMode} missionName="Orbiter-1" onHome={onHome} onDone={onDone} />;
}

const toggle = () => screen.getAllByRole('button', { name: /^(Language|ভাষা):/ })[0]!;

describe('the language switch', () => {
  it('Home: EN → বাংলা turns the words to Bangla, saves the choice and marks the page; it stays after a reload', () => {
    const first = render(<App />);
    expect(screen.getByRole('button', { name: /^HOW TO PLAY:/ })).toBeTruthy();
    expect(toggle().getAttribute('aria-label')).toBe('Language: EN → বাংলা');
    fireEvent.click(toggle());
    expect(lang()).toBe('bn');
    expect(document.documentElement.lang).toBe('bn');
    expect(screen.getByRole('button', { name: /^কীভাবে খেলবে:/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^HOW TO PLAY:/ })).toBeNull();
    expect(JSON.parse(localStorage.getItem('sd.lang')!)).toEqual({ lang: 'bn' });
    // a new visit reads it back
    first.unmount();
    render(<App />);
    expect(screen.getByRole('button', { name: /^কীভাবে খেলবে:/ })).toBeTruthy();
    expect(toggle().getAttribute('aria-label')).toBe('ভাষা: বাংলা → EN');
    fireEvent.click(toggle());
    expect(screen.getByRole('button', { name: /^HOW TO PLAY:/ })).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
  });

  it('in flight the switch changes the words, not the flight: same day, same numbers', () => {
    vi.useFakeTimers();
    render(<Flight />);
    for (let t = 0; t < 100; t += 50) act(() => vi.advanceTimersByTime(50));
    const day = document.querySelector('.fly-day-num')!.textContent;
    const finish = () => document.querySelector('.fly-action.finish')!.textContent;
    expect(finish()).toBe('FINISH MISSION ▸▸');
    act(() => fireEvent.click(toggle()));
    expect(finish()).toBe('মিশন শেষ করো ▸▸');
    expect(document.querySelector('.fly-day-num')!.textContent).toBe(day);
    act(() => fireEvent.click(toggle()));
    expect(finish()).toBe('FINISH MISSION ▸▸');
  });
});
