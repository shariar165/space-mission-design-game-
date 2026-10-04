// @vitest-environment jsdom
// Level map: unlocks and stars that persist (the Pack tests cover each level's shelf and the Jupiter lesson).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/ui/App';
import './setup';

const levelButton = (title: RegExp) => screen.getByRole('button', { name: title });

describe('Level map', () => {
  it('Cadet mode opens on the map; only the first Moon level is open', () => {
    render(<App />);
    expect(screen.getByText('Where will you fly next?')).toBeTruthy();
    expect((levelButton(/^First Light/) as HTMLButtonElement).disabled).toBe(false);
    expect((levelButton(/^Heavy Lifting/) as HTMLButtonElement).disabled).toBe(true);
    expect((levelButton(/^Giant Leap/) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a star on a level opens the next one, and stars persist between visits', () => {
    localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 2 }));
    render(<App />);
    expect((levelButton(/^Heavy Lifting/) as HTMLButtonElement).disabled).toBe(false);
    expect((levelButton(/^Full Build/) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: /^First Light/ }).textContent).toContain('First Light');
  });

});
