/**
 * The scroll on the back cover of the day's book: written in ink, sealed with wax, rolled
 * up and unrolled on a tap. Pure choreography — the words are the card's, already in place.
 *
 * It rests in one of three states (`data-state` on the scroll): `playing` (rolled, blank and
 * unsealed — the ceremony animates from there), `open` (unrolled, sealed at its foot), and
 * `rolled` (rolled up, the ribbon round its middle under the seal). Every animation it starts
 * fills forwards until the scene settles into a state, whose CSS matches where they ended.
 */

export type ScrollState = 'playing' | 'open' | 'rolled';

/** The wax the day is sealed in: what was read, against the goal. */
export type Wax = 'short' | 'met' | 'beyond' | 'book';

const EASE = 'cubic-bezier(0.45, 0, 0.25, 1)';
const ROLLED = 'inset(50% 0% 50% 0%)';
const UNROLLED = 'inset(0% 0% 0% 0%)';
/** Where the seal sits on the open scroll, from where it sits on the rolled one: its foot, on the left. */
const AT_THE_FOOT = 'translate(-5.1em, 7.9em)';
const RODS_MEET = '10.5em';
const LEAVES = ['🍂', '🍁', '🍂', '✨'];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Thrown inside a ceremony overtaken by another (or skipped): it simply stops. */
const OVERTAKEN = Symbol('overtaken');

export class ScrollScene {
  #run = 0;
  readonly #root: HTMLElement;

  constructor(root: HTMLElement) {
    this.#root = root;
  }

  get state(): ScrollState {
    return (this.#root.dataset.state as ScrollState | undefined) ?? 'open';
  }

  /** Lays the scroll down in a state at once, every animation dropped. */
  settle(state: ScrollState): void {
    this.#run++;
    this.#drop();
    this.#part('[data-leaves]').replaceChildren();
    this.#part('[data-quill]').style.opacity = '0';
    for (const c of this.#root.querySelectorAll('.scroll-ch')) c.classList.add('scroll-ch-on');
    this.#root.dataset.state = state;
    this.#root.dispatchEvent(new CustomEvent('scroll-state', { bubbles: true }));
  }

  /** Blank and rolled, before the ceremony: nothing shows on the back cover while the book turns. */
  hold(): void {
    this.settle('playing');
    for (const line of this.#lines()) splitIntoLetters(line);
  }

  /** The whole ceremony: unrolled, written, poured, pressed. Ends open. */
  async play(wax: Wax): Promise<void> {
    if (this.state !== 'playing') this.hold();
    if (reducedMotion()) return this.settle('open');
    const run = ++this.#run;
    const go = () => {
      if (run !== this.#run) throw OVERTAKEN;
    };
    try {
      await this.#animate(this.#root.querySelector('.scroll-body')!, [
        { opacity: 0, transform: 'translateY(-1.2em) scale(0.97)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 500, easing: 'ease-out' });
      go();
      await this.#unroll(false, 1000);
      go();
      await wait(200);
      await this.#write(go);
      await wait(250);
      go();
      await this.#pour(go);
      await wait(300);
      go();
      await this.#press(wax, go);
      go();
      this.settle('open');
    } catch (error) {
      if (error !== OVERTAKEN) throw error;
    }
  }

  /** Rolls the open scroll up, or unrolls the rolled one. */
  async toggle(): Promise<void> {
    const from = this.state;
    if (from === 'playing') return;
    const to = from === 'open' ? 'rolled' : 'open';
    if (reducedMotion()) return this.settle(to);
    const run = ++this.#run;
    await (from === 'open' ? this.#rollUp(800) : this.#unroll(true, 800));
    if (run === this.#run) this.settle(to);
  }

  // — the moves ——————————————————————————————————————————————————————————————————————

  #unroll(sealed: boolean, ms: number): Promise<unknown> {
    const o = { duration: ms, easing: EASE };
    return Promise.all([
      this.#animate(this.#part('[data-sheet]'), [{ clipPath: ROLLED }, { clipPath: UNROLLED }], o),
      this.#animate(this.#part('.scroll-rod-top'), [{ transform: `translateY(${RODS_MEET})` }, { transform: 'none' }], o),
      this.#animate(this.#part('.scroll-rod-bottom'), [{ transform: `translateY(-${RODS_MEET})` }, { transform: 'none' }], o),
      this.#animate(this.#part('.scroll-roll'), [{ opacity: 1 }, { opacity: 0, offset: 0.15 }, { opacity: 0 }], { duration: ms }),
      sealed
        ? Promise.all([
            this.#animate(this.#part('.scroll-band'), [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: ms * 0.2 }),
            this.#animate(this.#part('[data-spot]'), [{ transform: 'none' }, { transform: AT_THE_FOOT }], o),
          ])
        : this.#animate(this.#part('.scroll-tails'), [{ opacity: 0 }, { opacity: 1 }], { duration: ms * 0.4, delay: ms * 0.6 }),
    ]);
  }

  #rollUp(ms: number): Promise<unknown> {
    const o = { duration: ms, easing: EASE };
    return Promise.all([
      this.#animate(this.#part('[data-sheet]'), [{ clipPath: UNROLLED }, { clipPath: ROLLED }], o),
      this.#animate(this.#part('.scroll-rod-top'), [{ transform: 'none' }, { transform: `translateY(${RODS_MEET})` }], o),
      this.#animate(this.#part('.scroll-rod-bottom'), [{ transform: 'none' }, { transform: `translateY(-${RODS_MEET})` }], o),
      this.#animate(this.#part('.scroll-roll'), [{ opacity: 0 }, { opacity: 0, offset: 0.85 }, { opacity: 1 }], { duration: ms }),
      this.#animate(this.#part('[data-spot]'), [{ transform: AT_THE_FOOT }, { transform: 'none' }], o),
      this.#animate(this.#part('.scroll-band'), [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], {
        duration: ms * 0.25,
        delay: ms * 0.85,
        easing: 'ease-out',
      }),
    ]);
  }

  /** The librarian writes the day, letter by letter, the quill following the ink. */
  async #write(go: () => void): Promise<void> {
    const quill = this.#part('[data-quill]');
    const letters = [...this.#root.querySelectorAll<HTMLElement>('.scroll-ch')];
    if (letters.length === 0) return;
    const per = Math.max(8, Math.min(24, 2800 / letters.length));
    quill.style.opacity = '1';
    let line: Element | null = null;
    for (const letter of letters) {
      go();
      const its = letter.closest('[data-line]');
      if (line && its !== line) await wait(170);
      line = its;
      letter.classList.add('scroll-ch-on');
      const x = letter.offsetLeft + letter.offsetWidth;
      const y = letter.offsetTop + letter.offsetHeight;
      quill.style.transform = `translate(${x - 2}px, ${y - quill.offsetHeight + Math.sin(x / 6) * 2}px)`;
      await wait(per);
    }
    quill.style.opacity = '0';
  }

  /** A candle in the day's wax rises from below, tips, lets three drops fall, and sinks away. */
  async #pour(go: () => void): Promise<void> {
    const candle = this.#part('.candle');
    const tilt = this.#part('.candle-tilt');
    const flame = this.#part('.candle-flame');
    const drip = this.#part('.wax-drip');
    const puddle = this.#part('[data-puddle]');
    void this.#animate(candle, [
      { opacity: 1, transform: 'translateY(18em)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 850, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' });
    await wait(850);
    go();
    const tip = (from: number, to: number, duration: number) =>
      Promise.all([
        this.#animate(tilt, [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${to}deg)` }], { duration, easing: EASE }),
        // the flame stands upright, whichever way the candle leans
        this.#animate(flame, [{ transform: `rotate(${-from}deg)` }, { transform: `rotate(${-to}deg)` }], { duration, easing: EASE }),
      ]);
    await tip(0, -112, 550);
    go();
    let size = 0;
    for (const next of [0.35, 0.6, 0.85]) {
      await this.#animate(drip, [
        { opacity: 1, transform: 'translate(0, 0) scale(0.6)' },
        { opacity: 1, transform: 'translate(-1.3em, 3.4em) scale(1)' },
      ], { duration: 330, easing: 'cubic-bezier(0.5, 0, 1, 0.6)', fill: 'none' });
      go();
      void this.#animate(puddle, [
        { transform: `scale(${size})` },
        { transform: `scale(${next * 1.12})` },
        { transform: `scale(${next})` },
      ], { duration: 240, easing: 'ease-out' });
      size = next;
      await wait(140);
      go();
    }
    await tip(-112, 0, 450);
    go();
    void this.#animate(candle, [
      { opacity: 1, transform: 'none' },
      { opacity: 1, transform: 'translateY(18em)' },
    ], { duration: 750, easing: 'cubic-bezier(0.6, 0, 0.8, 0.4)' });
  }

  /** The brass stamp comes down, the wax spreads, and the day's mark is in it. */
  async #press(wax: Wax, go: () => void): Promise<void> {
    const gold = wax === 'beyond' || wax === 'book';
    void this.#animate(this.#part('.wax-stamp'), [
      { opacity: 0, transform: 'translateY(-9em)' },
      { opacity: 1, transform: 'translateY(-7em)', offset: 0.12 },
      { opacity: 1, transform: 'none', offset: 0.4 },
      { opacity: 1, transform: 'none', offset: 0.6 },
      { opacity: 1, transform: 'translateY(-7em)', offset: 0.88 },
      { opacity: 0, transform: 'translateY(-9em)' },
    ], { duration: 1150, easing: EASE, fill: 'none' });
    await wait(460);
    go();
    void this.#animate(this.#part('[data-puddle]'), [
      { transform: 'scale(0.85)' },
      { transform: 'scale(1.12, 0.9)' },
      { transform: 'scale(1)' },
    ], { duration: 380, easing: 'ease-out' });
    const [ripple, second] = this.#root.querySelectorAll<HTMLElement>('.wax-ripple');
    const spread = [{ opacity: 0.7, transform: 'scale(0.9)' }, { opacity: 0, transform: 'scale(2.3)' }];
    if (wax !== 'short' && ripple) void this.#animate(ripple, spread, { duration: 800, easing: 'ease-out', fill: 'none' });
    if (gold && second) void this.#animate(second, spread, { duration: 950, delay: 160, easing: 'ease-out', fill: 'none' });
    await wait(280);
    go();
    void this.#animate(this.#part('.wax-face'), [
      { opacity: 0, transform: 'scale(1.12)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 450, easing: 'ease-out' });
    this.#leaves(wax);
    if (gold) {
      void this.#animate(this.#part('.wax-rays'), [
        { opacity: 0, transform: 'scale(0.6)' },
        { opacity: 1, transform: 'scale(1)', offset: 0.4 },
        { opacity: 1, transform: 'scale(1)', offset: 0.75 },
        { opacity: 0, transform: 'scale(1.1)' },
      ], { duration: 2400, easing: 'ease-out', fill: 'none' });
      void this.#animate(this.#part('.wax-sheen'), [
        { transform: 'translateX(-130%)' },
        { transform: 'translateX(130%)' },
      ], { duration: 1100, delay: 450, easing: 'ease-in-out', fill: 'none' });
    }
    await wait(1400);
  }

  /** A single leaf drifting by for a short day; a puff for the goal; a flurry beyond it. */
  #leaves(wax: Wax): void {
    const box = this.#part('[data-leaves]');
    box.replaceChildren();
    if (wax === 'short') {
      const leaf = document.createElement('span');
      leaf.className = 'wax-leaf-drift';
      leaf.textContent = '🍂';
      box.append(leaf);
      return;
    }
    const count = wax === 'met' ? 8 : 20;
    for (let i = 0; i < count; i++) {
      const leaf = document.createElement('span');
      leaf.textContent = wax === 'met' ? (i % 2 ? '🍂' : '🍁') : (LEAVES[i % LEAVES.length] ?? '🍂');
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const distance = wax === 'met' ? 3.8 + Math.random() * 1.9 : 5.3 + Math.random() * 4.4;
      leaf.style.setProperty('--dx', `${Math.cos(angle) * distance}em`);
      leaf.style.setProperty('--dy', `${Math.sin(angle) * distance * 0.75 + 1.5}em`);
      leaf.style.setProperty('--spin', `${Math.random() * 540 - 270}deg`);
      leaf.style.animationDelay = `${Math.random() * 120}ms`;
      box.append(leaf);
    }
  }

  // — plumbing ———————————————————————————————————————————————————————————————————————

  #animate(element: Element, frames: Keyframe[], options: KeyframeAnimationOptions): Promise<unknown> {
    return element.animate(frames, { fill: 'forwards', ...options }).finished.catch(() => undefined);
  }

  /** Drops the animations this scene started; the CSS's own (the flame, the rays) run on. */
  #drop(): void {
    for (const animation of this.#root.getAnimations({ subtree: true })) {
      if (animation instanceof CSSAnimation || animation instanceof CSSTransition) continue;
      animation.cancel();
    }
  }

  #lines(): HTMLElement[] {
    return [...this.#root.querySelectorAll<HTMLElement>('[data-line]')].filter((line) => !line.hidden);
  }

  #part(selector: string): HTMLElement {
    const found = this.#root.querySelector<HTMLElement>(selector);
    if (!found) throw new Error(`scroll: missing ${selector}`);
    return found;
  }
}

/**
 * Splits a line's text into one span per letter, words kept whole so the line still wraps
 * where it would. The text itself is unchanged: `textContent` reads the same.
 */
function splitIntoLetters(line: HTMLElement): void {
  const text = line.textContent ?? '';
  const parts: Node[] = [];
  text.split(' ').forEach((word, i) => {
    if (i > 0) parts.push(document.createTextNode(' '));
    const whole = document.createElement('span');
    whole.className = 'scroll-word';
    for (const ch of word) {
      const letter = document.createElement('span');
      letter.className = 'scroll-ch';
      letter.textContent = ch;
      whole.append(letter);
    }
    parts.push(whole);
  });
  line.replaceChildren(...parts);
}
