// Generates the small synthesized UI sounds in assets/sounds. Usage: npx tsx scripts/make-sounds.ts
import { writeFileSync } from 'fs';

const RATE = 22050;
type Voice = { f: number; f2?: number; start: number; dur: number; amp: number; type?: 'sine' | 'tri' };

function render(voices: Voice[], total: number): Buffer {
  const n = Math.floor(total * RATE);
  const data = new Float32Array(n);
  for (const v of voices) {
    const s0 = Math.floor(v.start * RATE);
    const len = Math.floor(v.dur * RATE);
    let phase = 0;
    for (let i = 0; i < len && s0 + i < n; i++) {
      const t = i / len;
      const f = v.f2 ? v.f + (v.f2 - v.f) * t : v.f;
      phase += (2 * Math.PI * f) / RATE;
      const env = Math.min(1, i / (0.004 * RATE)) * Math.pow(1 - t, 2.2);
      const osc = v.type === 'tri' ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
      data[s0 + i] += osc * env * v.amp;
    }
  }
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32000), 44 + i * 2);
  return buf;
}

const out = (name: string, v: Voice[], total: number) => writeFileSync(`assets/sounds/${name}.wav`, render(v, total));
out('move', [{ f: 520, f2: 440, start: 0, dur: 0.07, amp: 0.35, type: 'tri' }], 0.08);
out('echo', [
  { f: 880, f2: 1320, start: 0, dur: 0.12, amp: 0.22 },
  { f: 1320, f2: 1760, start: 0.05, dur: 0.12, amp: 0.12 },
], 0.18);
out('blocked', [{ f: 160, f2: 110, start: 0, dur: 0.09, amp: 0.4, type: 'tri' }], 0.1);
out('toggle', [
  { f: 660, start: 0, dur: 0.06, amp: 0.3, type: 'tri' },
  { f: 990, start: 0.05, dur: 0.08, amp: 0.25, type: 'tri' },
], 0.14);
out('win', [
  { f: 523.25, start: 0, dur: 0.5, amp: 0.25 },
  { f: 659.25, start: 0.08, dur: 0.5, amp: 0.22 },
  { f: 783.99, start: 0.16, dur: 0.6, amp: 0.2 },
  { f: 1046.5, start: 0.24, dur: 0.7, amp: 0.15 },
], 1.0);
out('lose', [{ f: 330, f2: 220, start: 0, dur: 0.35, amp: 0.3, type: 'tri' }], 0.4);
console.log('ok');
