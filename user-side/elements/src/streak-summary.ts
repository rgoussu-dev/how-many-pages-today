import type { ReadingSnapshot } from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { plural } from './format';
import { PortBoundElement } from './port-bound';

/** `<hmpt-streak-summary>` — the streak (a candle kept burning), pages and books read, the reader's rank. */
export class StreakSummary extends PortBoundElement {
  protected markup(): string {
    return /* html */ `
      <section class="summary surface" aria-label="Your reading">
        <box-pk padding="var(--s1)">
          <stack-pk space="var(--s0)">
            <div class="summary-streak">
              <span class="summary-candle" aria-hidden="true"><span class="summary-flame"></span></span>
              <div>
                <p class="summary-big"><span data-streak>0</span> <span data-streak-unit>days</span></p>
                <p class="muted" data-streak-note>in a row</p>
              </div>
            </div>
            <grid-pk min="5.5rem" space="var(--s-1)" class="summary-stats">
              <div><p class="summary-value" data-best>0</p><p class="eyebrow">Best streak</p></div>
              <div><p class="summary-value" data-pages>0</p><p class="eyebrow">Pages read</p></div>
              <div><p class="summary-value" data-books>0</p><p class="eyebrow">Books read</p></div>
            </grid-pk>
            <p class="fleuron" aria-hidden="true">❦</p>
            <stack-pk space="var(--s-2)">
              <p class="summary-level"><span class="chip" data-rank>Rank I</span> <strong data-level>Page turner</strong></p>
              <div class="meter" role="progressbar" aria-label="Progress to the next rank" aria-valuemin="0" aria-valuemax="100" data-meter><span></span></div>
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

  #render({ stats, today }: ReadingSnapshot): void {
    const { currentStreak, bestStreak, totalPages, booksRead, level } = stats;
    this.toggleAttribute('data-alive', currentStreak > 0);
    this.$('[data-streak]').textContent = currentStreak.toLocaleString();
    this.$('[data-streak-unit]').textContent = currentStreak === 1 ? 'day' : 'days';
    this.$('[data-streak-note]').textContent =
      currentStreak === 0
        ? 'Read today to light the candle.'
        : today.status === 'completed'
          ? 'in a row — the candle burns on.'
          : 'in a row — read today to keep the candle lit.';
    this.$('[data-best]').textContent = bestStreak.toLocaleString();
    this.$('[data-pages]').textContent = totalPages.toLocaleString();
    this.$('[data-books]').textContent = booksRead.toLocaleString();
    this.$('[data-rank]').textContent = `Rank ${roman(level.rank)}`;
    this.$('[data-level]').textContent = level.title;
    const percent = level.pagesForLevel ? Math.min(100, (level.pagesIntoLevel / level.pagesForLevel) * 100) : 100;
    const meter = this.$('[data-meter]');
    meter.style.setProperty('--meter-value', `${percent.toFixed(1)}%`);
    meter.setAttribute('aria-valuenow', percent.toFixed(0));
    this.$('[data-next]').textContent = level.pagesForLevel
      ? `${plural(level.pagesForLevel - level.pagesIntoLevel, 'page')} to the next rank.`
      : 'The top of the ladder. Take a bow.';
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
