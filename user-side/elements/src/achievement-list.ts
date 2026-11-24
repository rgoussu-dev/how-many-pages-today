import type { ReadingSnapshot } from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { shortDate } from './format';
import { PortBoundElement } from './port-bound';

/** `<hmpt-achievement-list>` — every badge, earned ones in colour. */
export class AchievementList extends PortBoundElement {
  protected markup(): string {
    return /* html */ `
      <section class="achievements" aria-labelledby="achievements-title">
        <stack-pk space="var(--s0)">
          <div class="achievements-head">
            <h2 id="achievements-title">Achievements</h2>
            <span class="chip" data-count>0 / 0</span>
          </div>
          <grid-pk min="9.5rem" space="var(--s-1)" data-list role="list"></grid-pk>
        </stack-pk>
      </section>`;
  }

  protected connect() {
    const view = this.request(readingContexts.view);
    return [view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #render({ achievements }: ReadingSnapshot): void {
    const earned = achievements.filter((a) => a.unlockedOn).length;
    this.$('[data-count]').textContent = `${earned} / ${achievements.length}`;
    const ordered = [...achievements].sort((a, b) => Number(!a.unlockedOn) - Number(!b.unlockedOn));
    const tiles = ordered.map((achievement) => {
      const tile = document.createElement('div');
      tile.className = 'badge';
      tile.setAttribute('role', 'listitem');
      tile.toggleAttribute('data-earned', Boolean(achievement.unlockedOn));
      const icon = document.createElement('span');
      icon.className = 'badge-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = achievement.unlockedOn ? achievement.icon : '🔒';
      const title = document.createElement('strong');
      title.textContent = achievement.title;
      const description = document.createElement('span');
      description.className = 'badge-text';
      description.textContent = achievement.description;
      const when = document.createElement('span');
      when.className = 'badge-when';
      when.textContent = achievement.unlockedOn ? `Earned ${shortDate(achievement.unlockedOn)}` : 'Locked';
      tile.append(icon, title, description, when);
      return tile;
    });
    this.$('[data-list]').replaceChildren(...tiles);
  }
}
