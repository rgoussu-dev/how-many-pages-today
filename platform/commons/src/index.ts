import type { Clock, RandomSource } from '@hmpt/kernel';

export const systemClock: Clock = { now: () => new Date() };

export const mathRandom: RandomSource = { next: () => Math.random() };
