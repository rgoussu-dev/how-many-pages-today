import type {
  FinishedBook,
  MonthOverview,
  OverviewPort,
  PeriodTotals,
  ReadingSnapshot,
  ReadingView,
  YearOverview,
} from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { dateOf } from './format';
import { deviceSpeech, speech, type Speech } from './i18n';
import { PortBoundElement } from './port-bound';

type Scale = 'month' | 'year';

interface Column {
  /** Short axis label; empty to leave the tick unlabelled. */
  readonly tick: string;
  readonly value: number;
  readonly goal: number | null;
  /** The tooltip / table row: the value leads, the label follows. */
  readonly valueText: string;
  readonly label: string;
  readonly books: number;
  readonly short: boolean;
}

const dateUtc = (day: string): number => {
  const date = dateOf(day);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
};

/** A clean axis maximum: 1, 2, 2.5 or 5 × 10ⁿ, never below 10. */
function niceMax(value: number): number {
  const target = Math.max(10, value);
  const power = 10 ** Math.floor(Math.log10(target));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * power >= target) return step * power;
  return 10 * power;
}

function delta(now: number, before: number, period: string, { t }: Speech): string {
  if (before === 0) return now === 0 ? t.overview.noneEither(period) : t.overview.none(period);
  const diff = now - before;
  if (diff === 0) return t.overview.same(period);
  return t.overview.change(diff > 0, Math.abs(diff), period);
}

/**
 * `<hmpt-reading-overview>` — reading looked back on: a month or a year at a time, with
 * totals against the period before, a column chart, the highlights and the books finished.
 */
export class ReadingOverview extends PortBoundElement {
  #overview?: OverviewPort;
  #view?: ReadingView;
  #scale: Scale = 'month';
  #year = 0;
  #month = 0;
  #today = '';
  #request = 0;

  protected markup(): string {
    return /* html */ `
      <section class="surface overview" aria-labelledby="overview-title">
        <box-pk padding="var(--s1)">
          <stack-pk space="var(--s0)">
            <div class="ov-scale" role="group" data-t-label="overview.lookBackBy">
              <button type="button" class="ov-scale-btn" data-scale="month" aria-pressed="true" data-t="overview.month"></button>
              <button type="button" class="ov-scale-btn" data-scale="year" aria-pressed="false" data-t="overview.year"></button>
            </div>
            <div class="ov-nav">
              <button type="button" class="ov-step" data-step="-1">‹</button>
              <h2 id="overview-title" data-title aria-live="polite">…</h2>
              <button type="button" class="ov-step" data-step="1">›</button>
            </div>

            <grid-pk min="5.5rem" space="var(--s-1)" class="ov-stats">
              <div><p class="ov-value" data-pages>0</p><p class="eyebrow" data-t="overview.pagesRead"></p><p class="ov-delta" data-pages-delta></p></div>
              <div><p class="ov-value" data-days>0</p><p class="eyebrow" data-t="overview.daysRead"></p><p class="ov-delta" data-days-note></p></div>
              <div><p class="ov-value" data-books>0</p><p class="eyebrow" data-t="overview.booksFinished"></p><p class="ov-delta" data-books-delta></p></div>
            </grid-pk>

            <figure class="ov-chart">
              <figcaption class="ov-caption">
                <span data-caption></span>
                <span class="ov-key" data-goal-key><i class="ov-key-goal" aria-hidden="true"></i> <span data-t="overview.goalKey"></span></span>
              </figcaption>
              <div class="ov-plot" data-plot>
                <div class="ov-grid" aria-hidden="true">
                  <span class="ov-gridline" style="--at: 100%"><span data-grid-max></span></span>
                  <span class="ov-gridline" style="--at: 50%"><span data-grid-half></span></span>
                  <span class="ov-gridline ov-baseline" style="--at: 0%"><span>0</span></span>
                </div>
                <ol class="ov-columns" data-columns></ol>
                <div class="ov-tooltip" role="tooltip" data-tooltip hidden><strong data-tip-value></strong><span data-tip-label></span></div>
              </div>
            </figure>

            <details class="ov-table">
              <summary data-t="overview.showTable"></summary>
              <table>
                <thead><tr><th scope="col" data-table-unit></th><th scope="col" data-t="overview.pagesRead"></th><th scope="col" data-table-goal data-t="overview.goal"></th></tr></thead>
                <tbody data-table></tbody>
              </table>
            </details>

            <ul class="ov-highlights" data-highlights></ul>

            <p class="fleuron" aria-hidden="true">❦</p>
            <div class="ov-books">
              <h3 data-books-title></h3>
              <ol class="ov-book-list" data-book-list></ol>
              <p class="muted ov-empty" data-books-empty></p>
            </div>
          </stack-pk>
        </box-pk>
      </section>`;
  }

  protected override setup(): void {
    for (const button of this.querySelectorAll<HTMLButtonElement>('[data-scale]')) {
      button.addEventListener('click', () => {
        this.#scale = button.dataset.scale as Scale;
        void this.#load();
      });
    }
    for (const button of this.querySelectorAll<HTMLButtonElement>('[data-step]')) {
      button.addEventListener('click', () => {
        const step = Number(button.dataset.step);
        if (this.#scale === 'year') this.#year += step;
        else {
          const index = this.#year * 12 + (this.#month - 1) + step;
          this.#year = Math.floor(index / 12);
          this.#month = (index % 12) + 1;
        }
        void this.#load();
      });
    }
    const columns = this.$('[data-columns]');
    const show = (event: Event) => {
      const column = (event.target as HTMLElement).closest<HTMLElement>('li');
      if (column) this.#tooltip(column);
    };
    columns.addEventListener('pointerover', show);
    columns.addEventListener('focusin', show);
    columns.addEventListener('pointerleave', () => (this.$('[data-tooltip]').hidden = true));
    columns.addEventListener('focusout', () => (this.$('[data-tooltip]').hidden = true));
  }

  protected connect() {
    this.#overview = this.request(readingContexts.overview);
    this.#view = this.request(readingContexts.view);
    return [this.#view.subscribe((snapshot) => this.#onSnapshot(snapshot))];
  }

  #words(): Speech {
    const language = this.#view?.current()?.language;
    return language ? speech(language) : deviceSpeech();
  }

  #onSnapshot({ today, language }: ReadingSnapshot): void {
    this.speak(language);
    if (!this.#today) {
      const date = dateOf(today.day);
      this.#year = date.getFullYear();
      this.#month = date.getMonth() + 1;
    }
    this.#today = today.day;
    void this.#load(); // new reading lands in the period on screen
  }

  async #load(): Promise<void> {
    if (!this.#overview || !this.#year) return;
    const ticket = ++this.#request; // drop answers that arrive after a newer request
    for (const button of this.querySelectorAll<HTMLButtonElement>('[data-scale]')) {
      button.setAttribute('aria-pressed', String(button.dataset.scale === this.#scale));
    }
    if (this.#scale === 'month') {
      const month = await this.#overview.month(this.#year, this.#month);
      if (ticket === this.#request) this.#renderMonth(month);
    } else {
      const year = await this.#overview.year(this.#year);
      if (ticket === this.#request) this.#renderYear(year);
    }
  }

  #renderMonth(o: MonthOverview): void {
    const words = this.#words();
    const { t } = words;
    const previous = words.month(o.month === 1 ? 12 : o.month - 1, 'short');
    this.#renderFrame(words.monthYear(o.year, o.month), o.hasEarlier, o.hasLater, 'month', words);
    const elapsed = o.hasLater ? o.days.length : o.days.filter((d) => d.day <= this.#today).length;
    this.#renderTotals(o.totals, o.previous, previous, elapsed, !o.hasLater, words);
    const columns: Column[] = o.days.map((d, i) => ({
      tick: [0, 7, 14, 21, 28].includes(i) ? String(i + 1) : '',
      value: d.pagesRead,
      goal: d.goal,
      valueText: d.pagesRead ? t.overview.pages(d.pagesRead) : d.goal === null ? t.overview.noCard : t.overview.notRead,
      label: t.overview.dayDetail(words.dayLabel(d.day), d.goal, d.finishedBook),
      books: d.finishedBook ? 1 : 0,
      short: d.pagesRead > 0 && !d.goalMet,
    }));
    this.#renderChart(columns, t.overview.perDay, true, words);
    this.#renderTable(columns, t.overview.day, true, words);
    this.#renderHighlights([
      o.bestDay ? t.overview.bestDay(words.dayMonth(o.bestDay.day), o.bestDay.pagesRead) : null,
      o.longestStreak > 1 ? t.overview.longestRun(o.longestStreak) : null,
      o.totals.daysRead ? t.overview.goalsMet(o.totals.goalsMet, o.totals.daysRead) : null,
      o.totals.extraPages ? t.overview.beyond(o.totals.extraPages) : null,
      o.totals.daysRead ? t.overview.average(Math.round(o.totals.pagesRead / o.totals.daysRead)) : null,
    ]);
    this.#renderBooks(o.books, t.overview.booksFinished, t.overview.noBookMonth(words.month(o.month, 'short')), false, words);
  }

  #renderYear(o: YearOverview): void {
    const words = this.#words();
    const { t } = words;
    this.#renderFrame(String(o.year), o.hasEarlier, o.hasLater, 'year', words);
    const start = Date.UTC(o.year, 0, 1);
    const end = o.hasLater ? Date.UTC(o.year + 1, 0, 1) : dateUtc(this.#today) + 86_400_000;
    this.#renderTotals(o.totals, o.previous, String(o.year - 1), Math.round((end - start) / 86_400_000), !o.hasLater, words);
    const columns: Column[] = o.months.map((m) => ({
      tick: words.month(m.month, 'short').charAt(0).toLocaleUpperCase(),
      value: m.totals.pagesRead,
      goal: null,
      valueText: t.overview.pages(m.totals.pagesRead),
      label: t.overview.monthDetail(words.monthYear(o.year, m.month), m.totals.daysRead, m.totals.booksFinished),
      books: m.totals.booksFinished,
      short: false,
    }));
    this.#renderChart(columns, t.overview.perMonth, false, words);
    this.#renderTable(columns, t.overview.monthColumn, false, words);
    this.#renderHighlights([
      o.bestMonth ? t.overview.bestMonth(words.month(o.bestMonth.month), o.bestMonth.totals.pagesRead) : null,
      o.longestStreak > 1 ? t.overview.longestRun(o.longestStreak) : null,
      o.totals.daysRead ? t.overview.goalsMet(o.totals.goalsMet, o.totals.daysRead) : null,
      o.totals.extraPages ? t.overview.beyond(o.totals.extraPages) : null,
    ]);
    this.#renderBooks(o.books, t.overview.booksIn(o.year), t.overview.noBookYear(o.year), true, words);
  }

  #renderFrame(title: string, hasEarlier: boolean, hasLater: boolean, unit: Scale, { t }: Speech): void {
    this.$('[data-title]').textContent = title;
    const [back, forward] = this.querySelectorAll<HTMLButtonElement>('[data-step]');
    back!.disabled = !hasEarlier;
    forward!.disabled = !hasLater;
    back!.setAttribute('aria-label', t.overview.previousOf(unit));
    forward!.setAttribute('aria-label', t.overview.nextOf(unit));
  }

  #renderTotals(
    totals: PeriodTotals,
    previous: PeriodTotals,
    previousName: string,
    span: number,
    ongoing: boolean,
    words: Speech,
  ): void {
    const { t, num } = words;
    this.$('[data-pages]').textContent = num(totals.pagesRead);
    this.$('[data-pages-delta]').textContent = delta(totals.pagesRead, previous.pagesRead, previousName, words);
    this.$('[data-days]').textContent = num(totals.daysRead);
    this.$('[data-days-note]').textContent = ongoing ? t.overview.ofSoFar(span) : t.overview.of(span);
    this.$('[data-books]').textContent = num(totals.booksFinished);
    this.$('[data-books-delta]').textContent = delta(totals.booksFinished, previous.booksFinished, previousName, words);
  }

  #renderChart(columns: readonly Column[], caption: string, withGoals: boolean, { num }: Speech): void {
    this.$('[data-caption]').textContent = caption;
    this.$('[data-goal-key]').hidden = !withGoals;
    const max = niceMax(Math.max(0, ...columns.map((c) => Math.max(c.value, c.goal ?? 0))));
    this.$('[data-grid-max]').textContent = num(max);
    this.$('[data-grid-half]').textContent = num(max / 2);
    const best = columns.reduce((top, c, i) => (c.value > (columns[top]?.value ?? 0) ? i : top), -1);
    const list = this.$('[data-columns]');
    list.style.setProperty('--count', String(columns.length));
    list.dataset.scale = withGoals ? 'month' : 'year';
    list.replaceChildren(
      ...columns.map((c, i) => {
        const item = document.createElement('li');
        item.tabIndex = 0;
        item.dataset.value = c.valueText;
        item.dataset.label = c.label;
        item.setAttribute('aria-label', `${c.label}: ${c.valueText}`);
        item.toggleAttribute('data-short', c.short);
        const plot = document.createElement('span');
        plot.className = 'ov-plotcell';
        if (c.value > 0) {
          const bar = document.createElement('span');
          bar.className = 'ov-bar';
          bar.style.setProperty('--h', `${((c.value / max) * 100).toFixed(2)}%`);
          plot.append(bar);
          if (i === best) {
            // Label selectively: the period's best column carries its value.
            const value = document.createElement('span');
            value.className = 'ov-bar-value';
            value.style.setProperty('--h', `${((c.value / max) * 100).toFixed(2)}%`);
            value.textContent = num(c.value);
            plot.append(value);
          }
        }
        if (withGoals && c.goal !== null) {
          const goal = document.createElement('span');
          goal.className = 'ov-goal';
          goal.style.setProperty('--h', `${((c.goal / max) * 100).toFixed(2)}%`);
          plot.append(goal);
        }
        const tick = document.createElement('span');
        tick.className = 'ov-tick';
        tick.textContent = c.tick;
        const books = document.createElement('span');
        books.className = 'ov-book-mark';
        books.textContent = c.books ? (c.books > 1 ? `📕${c.books}` : '📕') : '';
        item.append(plot, tick, books);
        return item;
      }),
    );
  }

  #tooltip(column: HTMLElement): void {
    const tip = this.$('[data-tooltip]');
    this.$('[data-tip-value]').textContent = column.dataset.value ?? '';
    this.$('[data-tip-label]').textContent = column.dataset.label ?? '';
    tip.hidden = false;
    const plot = this.$('[data-plot]').getBoundingClientRect();
    const box = column.getBoundingClientRect();
    const centre = box.left + box.width / 2 - plot.left;
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.min(Math.max(centre, half), plot.width - half)}px`;
  }

  #renderTable(columns: readonly Column[], unit: string, withGoals: boolean, { num }: Speech): void {
    this.$('[data-table-unit]').textContent = unit;
    this.$('[data-table-goal]').hidden = !withGoals;
    this.$('[data-table]').replaceChildren(
      ...columns.map((c) => {
        const row = document.createElement('tr');
        const cells = [c.label.split(' · ')[0] ?? '', num(c.value), ...(withGoals ? [c.goal === null ? '—' : num(c.goal)] : [])];
        cells.forEach((text, i) => {
          const cell = document.createElement(i === 0 ? 'th' : 'td');
          if (i === 0) cell.setAttribute('scope', 'row');
          cell.textContent = text;
          row.append(cell);
        });
        return row;
      }),
    );
  }

  #renderHighlights(lines: readonly (string | null)[]): void {
    const items = lines.filter((l): l is string => l !== null).map((line) => {
      const item = document.createElement('li');
      item.textContent = line;
      return item;
    });
    this.$('[data-highlights]').replaceChildren(...items);
  }

  #renderBooks(books: readonly FinishedBook[], title: string, empty: string, byMonth: boolean, words: Speech): void {
    const { t } = words;
    this.$('[data-books-title]').textContent = title;
    this.$('[data-books-empty]').textContent = books.length ? '' : empty;
    this.$('[data-books-empty]').hidden = books.length > 0;
    let lastMonth = '';
    const items: HTMLElement[] = [];
    for (const book of books) {
      const month = words.month(dateOf(book.finishedOn).getMonth() + 1);
      if (byMonth && month !== lastMonth) {
        const heading = document.createElement('li');
        heading.className = 'ov-book-month eyebrow';
        heading.textContent = month;
        items.push(heading);
        lastMonth = month;
      }
      const item = document.createElement('li');
      item.className = 'ov-book';
      const name = document.createElement('cite');
      name.textContent = book.title ?? t.common.aBook;
      if (book.title === null) name.dataset.untitled = '';
      const when = document.createElement('span');
      when.className = 'muted';
      when.textContent = book.startedOn
        ? t.overview.span(words.dayMonth(book.startedOn), words.dayMonth(book.finishedOn))
        : t.overview.finishedOn(words.dayMonth(book.finishedOn));
      item.append(name, when);
      items.push(item);
    }
    this.$('[data-book-list]').replaceChildren(...items);
  }
}
