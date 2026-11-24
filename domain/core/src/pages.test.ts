import { describe, expect, it } from 'vitest';
import { SequenceRandom } from './testing';
import { drawPages, possiblePages, validateRange } from './pages';

describe('page ranges', () => {
  it('lists every count from min to max by step', () => {
    expect(possiblePages({ min: 10, max: 100, step: 10 })).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it('stops before max when the step does not land on it', () => {
    expect(possiblePages({ min: 5, max: 22, step: 5 })).toEqual([5, 10, 15, 20]);
  });

  it('yields only min when the step is wider than the range', () => {
    expect(possiblePages({ min: 30, max: 40, step: 25 })).toEqual([30]);
  });

  it('draws uniformly across the possible counts', () => {
    const range = { min: 10, max: 100, step: 10 };
    expect(drawPages(range, new SequenceRandom([0]))).toBe(10);
    expect(drawPages(range, new SequenceRandom([0.999999]))).toBe(100);
    expect(drawPages(range, new SequenceRandom([0.35]))).toBe(40);
  });

  it('rejects non-integers, out-of-bounds values and inverted ranges', () => {
    const fields = (r: { min: number; max: number; step: number }) => {
      const result = validateRange(r);
      return result.ok ? [] : result.error.map((e) => e.field);
    };
    expect(fields({ min: 10, max: 100, step: 10 })).toEqual([]);
    expect(fields({ min: 10.5, max: 100, step: 10 })).toEqual(['min']);
    expect(fields({ min: 0, max: 100, step: 0 })).toEqual(['min', 'step']);
    expect(fields({ min: 10, max: 5000, step: 10 })).toEqual(['max']);
    expect(fields({ min: 50, max: 20, step: 10 })).toEqual(['max']);
  });
});
