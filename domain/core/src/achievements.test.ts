import { describe, expect, it } from 'vitest';
import type { DailyChallenge } from '@hmpt/domain-contract';
import { earnedAchievements } from './achievements';
import { computeStats } from './stats';

const read = (day: string, pages = 20): DailyChallenge => ({
  day,
  pages,
  artSeed: 1,
  status: 'completed',
  drawnAt: `${day}T08:00:00.000Z`,
  completedAt: `${day}T12:00:00`,
});

const earned = (history: DailyChallenge[]) =>
  earnedAchievements({
    history,
    profile: null,
    shelf: { current: null, finished: [] },
    stats: computeStats(history, '2026-12-31'),
  });

describe('achievements', () => {
  it('recognises a full weekend', () => {
    expect(earned([read('2026-11-28'), read('2026-11-29')])).toContain('weekend'); // Sat + Sun
    expect(earned([read('2026-11-29'), read('2026-11-30')])).not.toContain('weekend'); // Sun + Mon
  });

  it('recognises a comeback after two missed days', () => {
    expect(earned([read('2026-11-01'), read('2026-11-04')])).toContain('comeback');
    expect(earned([read('2026-11-01'), read('2026-11-03')])).not.toContain('comeback');
  });

  it('awards the marathon for 100 pages actually read in a day', () => {
    expect(earned([read('2026-11-01', 100)])).toContain('marathon');
    expect(earned([read('2026-11-01', 90)])).not.toContain('marathon');
    expect(earned([{ ...read('2026-11-01', 40), pagesRead: 120 }])).toContain('marathon');
  });

  it('adds up pages beyond the goals toward bonus chapters', () => {
    const over = (day: string) => ({ ...read(day, 40), pagesRead: 75 }); // 35 extra each
    expect(earned([over('2026-11-01'), over('2026-11-02')])).not.toContain('extra-100');
    expect(earned([over('2026-11-01'), over('2026-11-02'), over('2026-11-03')])).toContain('extra-100');
  });

  it('recognises a 200-page day', () => {
    expect(earned([{ ...read('2026-11-01', 50), pagesRead: 200 }])).toContain('page-binge');
  });
});
