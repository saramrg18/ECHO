/** Axial hex coordinates (pointy-top). Pure math, no rendering. */

export interface Hex {
  q: number;
  r: number;
}

export const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const hexId = (q: number, r: number) => `${q},${r}`;

export function parseHexId(id: string): Hex {
  const [q, r] = id.split(',').map(Number);
  return { q, r };
}

export function neighborIds(id: string): string[] {
  const { q, r } = parseHexId(id);
  return DIRECTIONS.map((d) => hexId(q + d.q, r + d.r));
}

export function hexDistance(a: Hex, b: Hex): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export const distanceById = (a: string, b: string) => hexDistance(parseHexId(a), parseHexId(b));

/** World position on the ground plane (x, z) for a hex of the given outer radius. */
export function hexToWorld(h: Hex, size = 1): { x: number; z: number } {
  return { x: size * Math.sqrt(3) * (h.q + h.r / 2), z: size * 1.5 * h.r };
}

/** Inverse of hexToWorld, rounded to the nearest hex. */
export function worldToHex(x: number, z: number, size = 1): Hex {
  const q = ((Math.sqrt(3) / 3) * x - z / 3) / size;
  const r = ((2 / 3) * z) / size;
  return roundHex(q, r);
}

export function roundHex(fq: number, fr: number): Hex {
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q: q + 0, r: r + 0 };
}
