// @vitest-environment jsdom
// The sound manager (src/ui/sound.ts; spec UI rule 33) against a mocked AudioContext: nothing sounds before the
// player's first interaction (browser autoplay rules), loops run while held, mute is saved and silences everything,
// the volume is low, and a browser without audio stays silent without throwing.
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createSound, installUnlock, MASTER_GAIN, sound, UNLOCK_EVENTS, useLoop, type SoundDeps } from '../../src/ui/sound';
import { Ctx, Node, type Param, Source } from './fakeAudio';
import './setup';

/** A repeatable stand-in for Math.random (a small LCG), never exactly 0.5, so every click sample is non-zero. */
function lcg() {
  let x = 12345;
  return () => {
    x = (x * 1103515245 + 12345) % 2 ** 31;
    return (x + 0.25) / 2 ** 31;
  };
}

/** A manager over a fresh mocked context; `saved` records what the toggle saved. */
function setup(over: Partial<SoundDeps> = {}, savedOn = true) {
  const ctx = new Ctx();
  const made = vi.fn(() => ctx as unknown as AudioContext);
  const saved: boolean[] = [];
  const s = createSound({ audio: made, load: () => savedOn, save: (on) => saved.push(on), random: lcg(), ...over });
  return { s, ctx, made, saved };
}

describe('the sound manager', () => {
  it('makes no sound and no AudioContext before the first interaction (autoplay rules)', () => {
    const { s, ctx, made } = setup();
    s.play('beep');
    s.hold('hum');
    expect(made).not.toHaveBeenCalled();
    expect(ctx.nodes).toHaveLength(0);
    expect(s.playing()).toEqual([]);
  });

  it('on the first interaction: one context, resumed, a quiet master gain, and the loops held earlier start', () => {
    const { s, ctx, made } = setup();
    s.hold('hum');
    s.unlock();
    s.unlock();
    expect(made).toHaveBeenCalledTimes(1);
    expect(ctx.resume).toHaveBeenCalled();
    const master = ctx.nodes[0] as Node & { gain: Param };
    expect(master.kind).toBe('gain');
    expect(master.to).toContain(ctx.destination);
    // low default volume: 0.08 of full scale
    expect(master.gain.value).toBe(MASTER_GAIN);
    expect(MASTER_GAIN).toBeLessThanOrEqual(0.1);
    // the CRT hum: two steady oscillators (60 Hz and its overtone), started
    expect(s.playing()).toEqual(['hum']);
    const oscs = ctx.sources().filter((o) => o.kind === 'osc');
    expect(oscs.map((o) => o.frequency.value)).toEqual([60, 120]);
    expect(oscs.every((o) => o.started !== undefined && o.stopped === undefined)).toBe(true);
  });

  it('a cue plays its notes through the master gain', () => {
    const { s, ctx } = setup();
    s.unlock();
    s.play('beep');
    const beep = ctx.sources().find((o) => o.kind === 'osc')!;
    // the beep: one 1046 Hz sine, 0.14 s long (start at currentTime + 0.01 = 1.01, stop 0.02 after it ends)
    expect(beep.type).toBe('sine');
    expect(beep.frequency.log[0]).toEqual(['set', 1046, 1.01]);
    expect(beep.started).toBeCloseTo(1.01, 9);
    expect(beep.stopped).toBeCloseTo(1.01 + 0.14 + 0.02, 9);
    const gain = beep.to[0]!;
    expect(gain.to[0]).toBe(ctx.nodes[0]);
  });

  it('several holders share one loop: it stops only when the last lets go (releasing twice is harmless)', () => {
    const { s, ctx } = setup();
    s.unlock();
    const a = s.hold('static');
    const b = s.hold('static');
    expect(s.playing()).toEqual(['static']);
    expect(ctx.sources()).toHaveLength(1);
    a();
    a();
    expect(s.playing()).toEqual(['static']);
    b();
    expect(s.playing()).toEqual([]);
    // the noise source fades out (FADE_S = 0.08 s) and stops just after: 1 + 0.08 + 0.02
    expect(ctx.sources()[0]!.stopped).toBeCloseTo(1.1, 9);
  });

  it('each loop has its own sound: hum is tones, clack and rattle are clicks, static is noise', () => {
    const { s, ctx } = setup();
    s.unlock();
    for (const l of ['clack', 'static', 'rattle'] as const) s.hold(l);
    expect(s.playing().sort()).toEqual(['clack', 'rattle', 'static']);
    const bufs = ctx.sources().filter((o) => o.kind === 'buffer');
    expect(bufs).toHaveLength(3);
    expect(bufs.every((b) => b.loop)).toBe(true);
    // one second of clicks at 4000 samples/s: 30 clacks of 0.012 s (48 samples each), a dry teletype
    const clack = bufs[0]!.buffer as { length: number; getChannelData: () => Float32Array };
    expect(clack.length).toBe(4000);
    const nonZero = clack.getChannelData().filter((x) => x !== 0).length;
    // clicks are jittered by up to a quarter of their spacing, so two may overlap a little
    expect(nonZero).toBeGreaterThan(30 * 40);
    expect(nonZero).toBeLessThanOrEqual(30 * 48);
  });

  it('mute is saved, stops the loops and silences cues; unmuting restarts what is still held', () => {
    const { s, ctx, saved } = setup();
    s.unlock();
    s.hold('hum');
    s.setOn(false);
    expect(saved).toEqual([false]);
    expect(s.on()).toBe(false);
    expect(s.playing()).toEqual([]);
    const before = ctx.nodes.length;
    s.play('alarm');
    expect(ctx.nodes).toHaveLength(before);
    s.setOn(true);
    expect(saved).toEqual([false, true]);
    expect(s.playing()).toEqual(['hum']);
  });

  it('a player who muted last time stays muted: no context is made until they unmute', () => {
    const { s, made } = setup({}, false);
    s.unlock();
    s.hold('hum');
    s.play('beep');
    expect(made).not.toHaveBeenCalled();
    s.setOn(true);
    expect(made).toHaveBeenCalledTimes(1);
    expect(s.playing()).toEqual(['hum']);
  });

  it('tells the toggles when it is muted or unmuted', () => {
    const { s } = setup();
    const heard: boolean[] = [];
    const off = s.subscribe((on) => heard.push(on));
    s.setOn(false);
    off();
    s.setOn(true);
    expect(heard).toEqual([false]);
  });

  it('a browser without audio, or one that refuses it, stays silent and never throws', () => {
    for (const audio of [() => undefined, () => { throw new Error('blocked'); }]) {
      const { s } = setup({ audio });
      expect(() => {
        s.unlock();
        s.hold('static');
        s.play('alarm');
        s.setOn(false);
        s.setOn(true);
      }).not.toThrow();
      expect(s.playing()).toEqual([]);
    }
  });

  it('installUnlock: the first click, tap or key unlocks it once; a hidden tab pauses the sound', () => {
    const { s, ctx } = setup();
    const target = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
    const remove = vi.spyOn(target, 'removeEventListener');
    installUnlock(target as unknown as Window, s, doc as unknown as Document);
    expect(s.unlocked()).toBe(false);
    target.dispatchEvent(new Event('keydown'));
    expect(s.unlocked()).toBe(true);
    // the three listeners are taken off after the first interaction
    expect(remove.mock.calls.map((c) => c[0]).sort()).toEqual([...UNLOCK_EVENTS].sort());
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(ctx.suspend).toHaveBeenCalled();
    ctx.resume.mockClear();
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(ctx.resume).toHaveBeenCalled();
  });
});

describe('useLoop', () => {
  it('holds the loop while the component shows it, and lets go when it goes', () => {
    vi.stubGlobal('AudioContext', Ctx);
    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    expect(sound.unlocked()).toBe(true);
    function Crt({ on }: { on: boolean }) {
      useLoop('hum', on);
      return null;
    }
    const r = render(<Crt on />);
    expect(sound.playing()).toEqual(['hum']);
    r.rerender(<Crt on={false} />);
    expect(sound.playing()).toEqual([]);
    r.rerender(<Crt on />);
    expect(sound.playing()).toEqual(['hum']);
    r.unmount();
    expect(sound.playing()).toEqual([]);
  });
});
