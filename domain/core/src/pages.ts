import { err, ok, type RandomSource, type Result } from '@hmpt/kernel';
import { PAGE_RANGE_LIMITS, type FieldError, type PageRange } from '@hmpt/domain-contract';

export function validateRange(range: PageRange): Result<PageRange, FieldError[]> {
  const errors: FieldError[] = [];
  const { lowest, highest } = PAGE_RANGE_LIMITS;
  for (const field of ['min', 'max', 'step'] as const) {
    const value = range[field];
    if (!Number.isInteger(value)) errors.push({ field, problem: 'not-whole' });
    else if (value < lowest || value > highest) errors.push({ field, problem: 'out-of-range', min: lowest, max: highest });
  }
  if (errors.length === 0 && range.max < range.min) errors.push({ field: 'max', problem: 'below-minimum' });
  return errors.length === 0 ? ok({ min: range.min, max: range.max, step: range.step }) : err(errors);
}

/** min, min+step, … while ≤ max. A step wider than the range yields just [min]. */
export function possiblePages(range: PageRange): number[] {
  const values: number[] = [];
  for (let pages = range.min; pages <= range.max; pages += range.step) values.push(pages);
  return values;
}

export function drawPages(range: PageRange, random: RandomSource): number {
  const values = possiblePages(range);
  const index = Math.min(values.length - 1, Math.floor(random.next() * values.length));
  return values[index] ?? range.min;
}

export const drawArtSeed = (random: RandomSource): number => Math.floor(random.next() * 2 ** 31);
