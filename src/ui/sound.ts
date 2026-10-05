// Retro sound effects, made in the browser with WebAudio (no sound files). Presentation only: nothing here changes
// the simulation. Pitches (Hz) and lengths (s) are drawing-like constants, as the pixel layout in sdGeometry.ts.
// Every call survives a browser without audio (jsdom, old browsers, blocked autoplay): it just stays silent.
import { useEffect, useState } from 'react';
import { loadSoundOn, saveSoundOn } from './saves';

export type Cue = 'alarm' | 'chirp' | 'radio' | 'tick' | 'launch' | 'fanfare' | 'zap' | 'sad' | 'ding' | 'jingle';

type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine';
/** One note: start time, length, pitch (gliding to `to`), wave and loudness. */
interface Note {
  at: number;
  len: number;
  hz: number;
  to?: number;
  wave?: Wave;
  gain?: number;
}
/** A burst of filtered noise (rumble, crackle). */
interface Noise {
  at: number;
  len: number;
  filterHz: number;
  gain?: number;
}

const CUES: Record<Cue, { notes: Note[]; noise?: Noise[] }> = {
  alarm: { notes: [0, 0.16, 0.32].map((at) => ({ at, len: 0.11, hz: 880, wave: 'square' as const, gain: 0.5 })) },
  chirp: { notes: [{ at: 0, len: 0.18, hz: 520, to: 1240, wave: 'triangle' }] },
  radio: {
    notes: [
      { at: 0, len: 0.09, hz: 1320, wave: 'sine' },
      { at: 0.11, len: 0.12, hz: 990, wave: 'sine' },
    ],
    noise: [{ at: 0, len: 0.06, filterHz: 3000, gain: 0.15 }],
  },
  tick: { notes: [{ at: 0, len: 0.06, hz: 660, wave: 'square', gain: 0.35 }] },
  launch: { notes: [{ at: 0, len: 1.6, hz: 70, to: 140, wave: 'sawtooth', gain: 0.35 }], noise: [{ at: 0, len: 2.2, filterHz: 420, gain: 0.9 }] },
  fanfare: {
    notes: [
      { at: 0, len: 0.14, hz: 523, wave: 'square' },
      { at: 0.15, len: 0.14, hz: 659, wave: 'square' },
      { at: 0.3, len: 0.14, hz: 784, wave: 'square' },
      { at: 0.45, len: 0.42, hz: 1047, wave: 'square' },
    ],
  },
  zap: { notes: [{ at: 0, len: 0.35, hz: 1800, to: 120, wave: 'sawtooth', gain: 0.45 }], noise: [{ at: 0, len: 0.4, filterHz: 2400, gain: 0.5 }] },
  sad: {
    notes: [
      { at: 0, len: 0.3, hz: 392, wave: 'triangle' },
      { at: 0.32, len: 0.3, hz: 349, wave: 'triangle' },
      { at: 0.64, len: 0.7, hz: 262, to: 220, wave: 'triangle' },
    ],
  },
  ding: {
    notes: [
      { at: 0, len: 0.5, hz: 1568, wave: 'sine' },
      { at: 0.08, len: 0.6, hz: 2093, wave: 'sine', gain: 0.6 },
    ],
  },
  jingle: {
    notes: [
      { at: 0, len: 0.1, hz: 784, wave: 'square' },
      { at: 0.1, len: 0.1, hz: 988, wave: 'square' },
      { at: 0.2, len: 0.1, hz: 1175, wave: 'square' },
      { at: 0.3, len: 0.1, hz: 1568, wave: 'square' },
      { at: 0.42, len: 0.5, hz: 1319, wave: 'triangle' },
    ],
  },
};

/** Overall loudness: quiet by default, so the game never startles. */
const MASTER = 0.08;

let on = loadSoundOn();
const listeners = new Set<(on: boolean) => void>();
let ctx: AudioContext | undefined;
let noiseBuf: AudioBuffer | undefined;

function audio(): AudioContext | undefined {
  try {
    if (!ctx) {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return undefined;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return undefined;
  }
}

function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** Play a cue now (silent when sound is off or the browser has no audio). */
export function play(cue: Cue): void {
  if (!on) return;
  const c = audio();
  if (!c) return;
  try {
    const t0 = c.currentTime + 0.01;
    const out = c.createGain();
    out.gain.value = MASTER;
    out.connect(c.destination);
    const r = CUES[cue];
    for (const n of r.notes) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = n.wave ?? 'square';
      o.frequency.setValueAtTime(n.hz, t0 + n.at);
      if (n.to) o.frequency.exponentialRampToValueAtTime(n.to, t0 + n.at + n.len);
      g.gain.setValueAtTime(0.0001, t0 + n.at);
      g.gain.exponentialRampToValueAtTime(n.gain ?? 0.7, t0 + n.at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.len);
      o.connect(g).connect(out);
      o.start(t0 + n.at);
      o.stop(t0 + n.at + n.len + 0.02);
    }
    for (const n of r.noise ?? []) {
      const src = c.createBufferSource();
      src.buffer = noise(c);
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = n.filterHz;
      const g = c.createGain();
      g.gain.setValueAtTime(n.gain ?? 0.5, t0 + n.at);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.len);
      src.connect(f).connect(g).connect(out);
      src.start(t0 + n.at);
      src.stop(t0 + n.at + n.len + 0.02);
    }
  } catch {
    /* no audio: stay silent */
  }
}

export const soundOn = () => on;

export function setSoundOn(next: boolean) {
  on = next;
  saveSoundOn(next);
  for (const l of listeners) l(next);
  if (next) play('tick');
}

/** Sound on/off for a toggle button, kept in step across the screens. */
export function useSoundOn(): [boolean, (on: boolean) => void] {
  const [v, setV] = useState(on);
  useEffect(() => {
    listeners.add(setV);
    setV(on);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return [v, setSoundOn];
}
