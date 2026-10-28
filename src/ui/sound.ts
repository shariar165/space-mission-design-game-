// Retro sound, made in the browser with WebAudio (no sound files). Presentation only: nothing here changes the
// simulation (spec UI rule 33). Pitches (Hz), lengths (s) and loudness are drawing-like constants, as the pixel
// layout in sdGeometry.ts.
// - Cues are one-shot sounds (a beep, an alarm); loops run while something holds them (the CRT hum, the teletype's
//   clack while text types, radio static while a signal is in transit, the printer's rattle during a downlink).
// - Nothing sounds before the player's first click, tap or key press (browser autoplay rules): the AudioContext is
//   only made then, and a loop held earlier starts at that moment.
// - Sound is on at a low volume unless the player muted it (saved in the browser as `sd.sound`).
// Every call survives a browser without audio (jsdom, old browsers, blocked audio): it just stays silent.
import { useEffect, useState } from 'react';
import { loadSoundOn, saveSoundOn } from './saves';

export type Cue = 'alarm' | 'chirp' | 'radio' | 'beep' | 'tick' | 'launch' | 'fanfare' | 'zap' | 'sad' | 'ding' | 'jingle' | 'shutter';
export type Loop = 'hum' | 'clack' | 'static' | 'rattle';

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
  /** A danger card opens: a short two-tone alert. */
  alarm: { notes: [0, 0.16, 0.32].map((at, i) => ({ at, len: 0.11, hz: i === 1 ? 660 : 880, wave: 'square' as const, gain: 0.5 })) },
  chirp: { notes: [{ at: 0, len: 0.18, hz: 520, to: 1240, wave: 'triangle' }] },
  radio: {
    notes: [
      { at: 0, len: 0.09, hz: 1320, wave: 'sine' },
      { at: 0.11, len: 0.12, hz: 990, wave: 'sine' },
    ],
    noise: [{ at: 0, len: 0.06, filterHz: 3000, gain: 0.15 }],
  },
  /** An order reaches the robot, or its reply reaches Earth: one clean beep. */
  beep: { notes: [{ at: 0, len: 0.14, hz: 1046, wave: 'sine', gain: 0.6 }] },
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
  /** OBSERVE sent: a camera shutter. */
  shutter: { notes: [{ at: 0, len: 0.05, hz: 2400, wave: 'square', gain: 0.3 }], noise: [{ at: 0, len: 0.05, filterHz: 5000, gain: 0.5 }, { at: 0.09, len: 0.04, filterHz: 4000, gain: 0.35 }] },
};

/**
 * The loops. `tones` are steady oscillators; `clicks` fill a one-second buffer with short noise clicks (`perS` a
 * second, jittered) that repeats; `noise` is steady noise. Each goes through a filter and its own level.
 */
interface LoopDef {
  gain: number;
  filter: { type: BiquadFilterType; hz: number; q?: number };
  tones?: { hz: number; wave: Wave; gain: number }[];
  clicks?: { perS: number; len: number };
  noise?: boolean;
}
const LOOPS: Record<Loop, LoopDef> = {
  /** The CRT: a soft mains hum and its first overtone. */
  hum: { gain: 0.22, filter: { type: 'lowpass', hz: 400 }, tones: [{ hz: 60, wave: 'sine', gain: 0.6 }, { hz: 120, wave: 'triangle', gain: 0.25 }] },
  /** The teletype typing: a dry clack per character. */
  clack: { gain: 0.5, filter: { type: 'highpass', hz: 1400 }, clicks: { perS: 30, len: 0.012 } },
  /** A signal crossing space: band-limited radio static. */
  static: { gain: 0.3, filter: { type: 'bandpass', hz: 1800, q: 0.7 }, noise: true },
  /** The downlink printer: a fast, dull rattle. */
  rattle: { gain: 0.45, filter: { type: 'lowpass', hz: 2600 }, clicks: { perS: 48, len: 0.008 } },
};

/** Overall loudness: quiet by default, so the game never startles. */
export const MASTER_GAIN = 0.08;
/** Loops fade in and out over this long (s), so they never click. */
const FADE_S = 0.08;

/** The events that count as the player's first interaction (browser autoplay rules). */
export const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

export interface SoundDeps {
  /** Make the AudioContext (only called after the first interaction); undefined: no audio here. */
  audio: () => AudioContext | undefined;
  load: () => boolean;
  save: (on: boolean) => void;
  /** Noise and click jitter (default Math.random). */
  random?: () => number;
}

export interface SoundManager {
  /** Play a cue now; silent when muted, before the first interaction, or without audio. */
  play(cue: Cue): void;
  /** Hold a loop on until the returned release is called; several holders share one loop. */
  hold(loop: Loop): () => void;
  /** The player's first interaction: audio may start now. */
  unlock(): void;
  unlocked(): boolean;
  /** The page went to the background (true) or came back: pause and resume all sound. */
  setHidden(hidden: boolean): void;
  on(): boolean;
  /** Mute (false) or unmute; saved. */
  setOn(next: boolean): void;
  /** Loops sounding now (for tests and the toggle). */
  playing(): Loop[];
  subscribe(listener: (on: boolean) => void): () => void;
}

export function createSound(deps: SoundDeps): SoundManager {
  const random = deps.random ?? Math.random;
  let on = deps.load();
  let unlocked = false;
  let hidden = false;
  let ctx: AudioContext | undefined;
  let master: GainNode | undefined;
  let noiseBuf: AudioBuffer | undefined;
  const clickBufs = new Map<Loop, AudioBuffer>();
  const holds = new Map<Loop, number>();
  const running = new Map<Loop, () => void>();
  const listeners = new Set<(on: boolean) => void>();

  /** The context and its master gain, made on first use after the unlock. */
  function audio(): AudioContext | undefined {
    if (!unlocked || !on) return undefined;
    try {
      if (!ctx) {
        ctx = deps.audio();
        if (!ctx) return undefined;
        master = ctx.createGain();
        master.gain.value = MASTER_GAIN;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended' && !hidden) void ctx.resume();
      return ctx;
    } catch {
      return undefined;
    }
  }

  function noise(c: AudioContext): AudioBuffer {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = random() * 2 - 1;
    }
    return noiseBuf;
  }

  /** One second of clicks: each a short decaying noise burst, spaced about 1/perS apart. */
  function clicks(c: AudioContext, loop: Loop, def: { perS: number; len: number }): AudioBuffer {
    let b = clickBufs.get(loop);
    if (!b) {
      b = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = b.getChannelData(0);
      const step = c.sampleRate / def.perS;
      const len = Math.max(1, Math.round(def.len * c.sampleRate));
      for (let k = 0; k < def.perS; k++) {
        const at = Math.floor(k * step + (random() - 0.5) * step * 0.5);
        const loud = 0.6 + 0.4 * random();
        for (let i = 0; i < len; i++) {
          const j = at + i;
          if (j >= 0 && j < d.length) d[j] = (random() * 2 - 1) * loud * (1 - i / len);
        }
      }
      clickBufs.set(loop, b);
    }
    return b;
  }

  function play(cue: Cue): void {
    const c = audio();
    if (!c || !master) return;
    try {
      const t0 = c.currentTime + 0.01;
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
        o.connect(g).connect(master);
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
        src.connect(f).connect(g).connect(master);
        src.start(t0 + n.at);
        src.stop(t0 + n.at + n.len + 0.02);
      }
    } catch {
      /* no audio: stay silent */
    }
  }

  /** Start a loop; returns its stop (a short fade, then the sources end). */
  function start(loop: Loop): (() => void) | undefined {
    const c = audio();
    if (!c || !master) return undefined;
    try {
      const def = LOOPS[loop];
      const t0 = c.currentTime;
      const level = c.createGain();
      level.gain.setValueAtTime(0.0001, t0);
      level.gain.exponentialRampToValueAtTime(def.gain, t0 + FADE_S);
      const f = c.createBiquadFilter();
      f.type = def.filter.type;
      f.frequency.value = def.filter.hz;
      if (def.filter.q !== undefined) f.Q.value = def.filter.q;
      f.connect(level).connect(master);
      const sources: AudioScheduledSourceNode[] = [];
      for (const t of def.tones ?? []) {
        const o = c.createOscillator();
        o.type = t.wave;
        o.frequency.value = t.hz;
        const g = c.createGain();
        g.gain.value = t.gain;
        o.connect(g).connect(f);
        sources.push(o);
      }
      if (def.clicks || def.noise) {
        const src = c.createBufferSource();
        src.buffer = def.clicks ? clicks(c, loop, def.clicks) : noise(c);
        src.loop = true;
        src.connect(f);
        sources.push(src);
      }
      for (const s of sources) s.start(t0);
      return () => {
        try {
          const t1 = c.currentTime;
          level.gain.cancelScheduledValues(t1);
          level.gain.setValueAtTime(Math.max(0.0001, level.gain.value), t1);
          level.gain.exponentialRampToValueAtTime(0.0001, t1 + FADE_S);
          for (const s of sources) s.stop(t1 + FADE_S + 0.02);
        } catch {
          /* already gone */
        }
      };
    } catch {
      return undefined;
    }
  }

  /** Make the running loops match the holds (and mute, and the unlock). */
  function sync() {
    for (const loop of Object.keys(LOOPS) as Loop[]) {
      const want = on && unlocked && (holds.get(loop) ?? 0) > 0;
      const stop = running.get(loop);
      if (want && !stop) {
        const s = start(loop);
        if (s) running.set(loop, s);
      } else if (!want && stop) {
        stop();
        running.delete(loop);
      }
    }
  }

  function hold(loop: Loop): () => void {
    holds.set(loop, (holds.get(loop) ?? 0) + 1);
    sync();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      holds.set(loop, Math.max(0, (holds.get(loop) ?? 0) - 1));
      sync();
    };
  }

  return {
    play,
    hold,
    unlock() {
      if (unlocked) return;
      unlocked = true;
      audio();
      sync();
    },
    unlocked: () => unlocked,
    setHidden(h) {
      hidden = h;
      if (!ctx) return;
      try {
        if (h) void ctx.suspend();
        else if (on) void ctx.resume();
      } catch {
        /* no audio */
      }
    },
    on: () => on,
    setOn(next) {
      on = next;
      deps.save(next);
      for (const l of listeners) l(next);
      sync();
      if (next) play('tick');
    },
    playing: () => [...running.keys()],
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

/** The first click, tap or key press unlocks audio; a hidden tab pauses it. Returns a function that removes the listeners. */
export function installUnlock(target: Pick<Window, 'addEventListener' | 'removeEventListener'>, s: SoundManager, doc?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>): () => void {
  const onFirst = () => {
    s.unlock();
    for (const e of UNLOCK_EVENTS) target.removeEventListener(e, onFirst, true);
  };
  for (const e of UNLOCK_EVENTS) target.addEventListener(e, onFirst, true);
  const onVisible = () => doc && s.setHidden(doc.visibilityState === 'hidden');
  doc?.addEventListener('visibilitychange', onVisible);
  return () => {
    for (const e of UNLOCK_EVENTS) target.removeEventListener(e, onFirst, true);
    doc?.removeEventListener('visibilitychange', onVisible);
  };
}

function browserAudio(): AudioContext | undefined {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const AC = w.AudioContext ?? w.webkitAudioContext;
  return AC ? new AC() : undefined;
}

/** The game's one sound manager. */
export const sound: SoundManager = createSound({ audio: browserAudio, load: loadSoundOn, save: saveSoundOn });
if (typeof window !== 'undefined') installUnlock(window, sound, typeof document !== 'undefined' ? document : undefined);

/** Play a cue now (silent when sound is off, before the first interaction, or without audio). */
export const play = (cue: Cue): void => sound.play(cue);
export const soundOn = () => sound.on();
export const setSoundOn = (next: boolean) => sound.setOn(next);

/** Sound on/off for a toggle button, kept in step across the screens. */
export function useSoundOn(): [boolean, (on: boolean) => void] {
  const [v, setV] = useState(sound.on());
  useEffect(() => {
    setV(sound.on());
    return sound.subscribe(setV);
  }, []);
  return [v, setSoundOn];
}

/** Hold a loop while `active` (a component's sound: the CRT's hum, a typing teletype, a signal in transit). */
export function useLoop(loop: Loop, active = true): void {
  useEffect(() => (active ? sound.hold(loop) : undefined), [loop, active]);
}
