import type { ReadingSnapshot } from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { PortBoundElement } from './port-bound';

/** `<hmpt-streak-summary>` — the streak (a candle kept burning), pages and books read, the reader's rank. */
export class StreakSummary extends PortBoundElement {
  protected markup(): string {
    return /* html */ `
      <section class="summary surface" data-t-label="summary.region">
        <box-pk padding="var(--s1)">
          <stack-pk space="var(--s0)">
            <div class="summary-streak">
              <span class="summary-candle" aria-hidden="true"><span class="summary-flame"></span></span>
              <div>
                <p class="summary-big"><span data-streak>0</span> <span data-streak-unit></span></p>
                <p class="muted" data-streak-note></p>
              </div>
            </div>
            <grid-pk min="5.5rem" space="var(--s-1)" class="summary-stats">
              <div><p class="summary-value" data-best>0</p><p class="eyebrow" data-t="summary.best"></p></div>
              <div><p class="summary-value" data-pages>0</p><p class="eyebrow" data-t="summary.pagesRead"></p></div>
              <div><p class="summary-value" data-books>0</p><p class="eyebrow" data-t="summary.booksRead"></p></div>
            </grid-pk>
            <p class="fleuron" aria-hidden="true">❦</p>
            <stack-pk space="var(--s-2)">
              <p class="summary-level"><span class="chip" data-rank></span> <strong data-level></strong></p>
              <div class="meter" role="progressbar" data-t-label="summary.meter" aria-valuemin="0" aria-valuemax="100" data-meter><span></span></div>
              <p class="muted summary-next" data-next></p>
            </stack-pk>
          </stack-pk>
        </box-pk>
      </section>`;
  }

  protected connect() {
    const view = this.request(readingContexts.view);
    return [view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #render({ stats, today, language }: ReadingSnapshot): void {
    const { t, num } = this.speak(language);
    const { currentStreak, bestStreak, totalPages, booksRead, level } = stats;
    this.toggleAttribute('data-alive', currentStreak > 0);
    this.$('[data-streak]').textContent = num(currentStreak);
    this.$('[data-streak-unit]').textContent = t.summary.unit(currentStreak);
    this.$('[data-streak-note]').textContent =
      currentStreak === 0 ? t.summary.lightIt : today.status === 'completed' ? t.summary.burnsOn : t.summary.keepLit;
    this.$('[data-best]').textContent = num(bestStreak);
    this.$('[data-pages]').textContent = num(totalPages);
    this.$('[data-books]').textContent = num(booksRead);
    this.$('[data-rank]').textContent = t.summary.rank(roman(level.rank));
    this.$('[data-level]').textContent = t.summary.levels[level.rank - 1] ?? '';
    const percent = level.pagesForLevel ? Math.min(100, (level.pagesIntoLevel / level.pagesForLevel) * 100) : 100;
    const meter = this.$('[data-meter]');
    meter.style.setProperty('--meter-value', `${percent.toFixed(1)}%`);
    meter.setAttribute('aria-valuenow', percent.toFixed(0));
    this.$('[data-next]').textContent = level.pagesForLevel
      ? t.summary.toNext(level.pagesForLevel - level.pagesIntoLevel)
      : t.summary.top;
  }
}

const roman = (value: number): string => {
  const table: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let rest = value;
  let out = '';
  for (const [n, glyph] of table) {
    while (rest >= n) {
      out += glyph;
      rest -= n;
    }
  }
  return out;
};
