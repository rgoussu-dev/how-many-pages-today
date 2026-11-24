/** Small shared tools for the procedural paintings: seeded randomness and tidy numbers. */

export type Rng = () => number;

/** mulberry32 — tiny, fast, good enough for pictures. */
export function seeded(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const between = (rng: Rng, low: number, high: number): number => low + rng() * (high - low);
export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)] as T;
/** One decimal at most — short SVG, no float noise. */
export const n = (value: number): string => (Math.round(value * 10) / 10).toString();
