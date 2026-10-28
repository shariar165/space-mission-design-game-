// A stand-in for the browser's AudioContext (jsdom has none): it records the nodes made, their connections, the
// values scheduled on their params and when sources start and stop. Not a test file itself.
import { vi } from 'vitest';

export class Param {
  value = 0;
  log: [string, number, number?][] = [];
  setValueAtTime(v: number, t: number) {
    this.value = v;
    this.log.push(['set', v, t]);
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.value = v;
    this.log.push(['ramp', v, t]);
    return this;
  }
  cancelScheduledValues(t: number) {
    this.log.push(['cancel', 0, t]);
    return this;
  }
}
export class Node {
  kind: string;
  to: Node[] = [];
  constructor(kind: string) {
    this.kind = kind;
  }
  connect<T extends Node>(n: T): T {
    this.to.push(n);
    return n;
  }
}
export class Source extends Node {
  type = '';
  loop = false;
  buffer: unknown;
  frequency = new Param();
  started?: number;
  stopped?: number;
  start(t = 0) {
    this.started = t;
  }
  stop(t = 0) {
    this.stopped = t;
  }
}
export class Ctx {
  state: 'suspended' | 'running' = 'suspended';
  currentTime = 1;
  sampleRate = 4000;
  destination = new Node('destination');
  nodes: Node[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  private add<T extends Node>(n: T): T {
    this.nodes.push(n);
    return n;
  }
  createGain() {
    return this.add(Object.assign(new Node('gain'), { gain: new Param() }));
  }
  createOscillator() {
    return this.add(new Source('osc'));
  }
  createBufferSource() {
    return this.add(new Source('buffer'));
  }
  createBiquadFilter() {
    return this.add(Object.assign(new Node('filter'), { type: '', frequency: new Param(), Q: new Param() }));
  }
  createBuffer(_ch: number, length: number) {
    const data = new Float32Array(length);
    return { length, getChannelData: () => data };
  }
  sources() {
    return this.nodes.filter((n): n is Source => n instanceof Source);
  }
}
