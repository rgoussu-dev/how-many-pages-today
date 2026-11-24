import type { DailyChallenge, ReadingSnapshot } from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { addDays, dateOf, longDate, plural } from './format';
import { PortBoundElement } from './port-bound';

const WEEKS = 6;

/** `<hmpt-history-calendar>` — the last six weeks, one square per day, Monday first. */
export class HistoryCalendar extends PortBoundElement {
  protected markup(): string {
    const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span aria-hidden="true">${d}</span>`).join('');
    return /* html */ `
      <section class="calendar surface" aria-labelledby="calendar-title">
        <box-pk padding="var(--s1)">
          <stack-pk space="var(--s0)">
            <h2 id="calendar-title">Last six weeks</h2>
            <div class="calendar-grid calendar-head">${weekdays}</div>
            <ol class="calendar-grid" data-days></ol>
            <cluster-pk space="var(--s0)" class="calendar-legend" aria-hidden="true">
              <span><i class="cal-swatch" data-state="completed"></i> read</span>
              <span><i class="cal-swatch" data-state="missed"></i> missed</span>
              <span><i class="cal-swatch" data-state="today"></i> today</span>
            </cluster-pk>
          </stack-pk>
        </box-pk>
      </section>`;
  }

  protected connect() {
    const view = this.request(readingContexts.view);
    return [view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #render({ today, history }: ReadingSnapshot): void {
    const byDay = new Map<string, DailyChallenge>(history.map((c) => [c.day, c]));
    const mondayOffset = (dateOf(today.day).getDay() + 6) % 7; // 0 when today is a Monday
    const first = addDays(today.day, -(mondayOffset + (WEEKS - 1) * 7));
    const firstEver = history.at(-1)?.day ?? today.day;
    const cells: HTMLLIElement[] = [];
    for (let i = 0; i < WEEKS * 7; i++) {
      const day = addDays(first, i);
      const cell = document.createElement('li');
      const card = byDay.get(day);
      const state =
        day > today.day
          ? 'future'
          : card?.status === 'completed'
            ? 'completed'
            : day === today.day
              ? 'today'
              : day < firstEver
                ? 'before'
                : 'missed';
      cell.dataset.state = state;
      if (day === today.day) cell.dataset.today = '';
      cell.textContent = String(dateOf(day).getDate());
      cell.title =
        state === 'completed' && card
          ? `${longDate(day)} — ${plural(card.pages, 'page')} read`
          : `${longDate(day)}${state === 'missed' ? ' — missed' : ''}`;
      cell.setAttribute('aria-label', cell.title);
      cells.push(cell);
    }
    this.$('[data-days]').replaceChildren(...cells);
  }
}
