/**
 * The charter on the back cover of the day's book: written in iron-gall ink under a red
 * rubric, its initial illuminated, sealed in the day's wax on two cords, rolled up and
 * unrolled on a tap. Pure choreography — the words are the card's, already in place.
 *
 * It rests in one of three states (`data-state` on the scroll): `playing` (rolled, blank and
 * unsealed — the ceremony animates from there), `open` (unrolled, the seal hanging at its
 * foot), and `rolled` (rolled up, the cords wound round its middle under the seal). Every
 * animation it starts fills forwards until the scene settles into a state, whose CSS matches
 * where they ended.
 */

export type ScrollState = 'playing' | 'open' | 'rolled';

/** The wax the day is sealed in: what was read, against the goal. */
export type Wax = 'short' | 'met' | 'beyond' | 'book';

const EASE = 'cubic-bezier(0.45, 0, 0.25, 1)';
const ROLLED = 'inset(50% 0% 50% 0%)';
const UNROLLED = 'inset(0% 0% 0% 0%)';
/** Where the seal hangs on the open charter, from where it sits on the rolled one: its foot, on the left. */
const AT_THE_FOOT = 'translate(-5.1em, 7.9em)';
/**
 * Rolling up, each curled end travels to the middle and thickens as the skin winds onto it,
 * until the two lie side by side exactly where the rolled charter lies — then the roll takes
 * over above them, so nothing jumps.
 */
const TOP_WOUND = 'translateY(9.675em) scaleY(1.27)';
const BOTTOM_WOUND = 'translateY(-9.675em) scaleY(1.27)';
const SVG = 'http://www.w3.org/2000/svg';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isGold = (wax: Wax) => wax === 'beyond' || wax === 'book';

/** Thrown inside a ceremony overtaken by another (or skipped): it simply stops. */
const OVERTAKEN = Symbol('overtaken');

/** A seeded random, so the same day always spreads its wax, and shapes its hand, the same way. */
export function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class ScrollScene {
  #run = 0;
  readonly #root: HTMLElement;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#part('[data-quill]').replaceChildren(quill());
  }

  get state(): ScrollState {
    return (this.#root.dataset.state as ScrollState | undefined) ?? 'open';
  }

  /** The pool the wax spreads into: wobbled, the same for the same seed. */
  shape(seed: number): void {
    this.#part('[data-blob]').setAttribute('d', blob(50, seed));
  }

  /** Lays the charter down in a state at once, every animation dropped. */
  settle(state: ScrollState): void {
    this.#run++;
    this.#drop();
    this.#part('[data-motes]').replaceChildren();
    this.#part('[data-quill]').style.opacity = '0';
    for (const c of this.#root.querySelectorAll('.scroll-ch')) c.classList.add('scroll-ch-on');
    this.#part('[data-initial]').classList.add('scroll-painted');
    this.#part('[data-paraph]').classList.add('scroll-drawn');
    this.#root.dataset.state = state;
    this.#root.dispatchEvent(new CustomEvent('scroll-state', { bubbles: true }));
  }

  /** Blank and rolled, before the ceremony: nothing shows on the back cover while the book turns. */
  hold(seed: number): void {
    this.settle('playing');
    this.#part('[data-initial]').classList.remove('scroll-painted', 'scroll-gilding');
    this.#part('[data-paraph]').classList.remove('scroll-drawn');
    const random = seeded(seed);
    for (const line of this.#lines()) splitIntoLetters(line, random);
  }

  /** The whole ceremony: unrolled, written, illuminated, poured, pressed. Ends open. */
  async play(wax: Wax, seed: number): Promise<void> {
    if (this.state !== 'playing') this.hold(seed);
    if (reducedMotion()) return this.settle('open');
    const run = ++this.#run;
    const go = () => {
      if (run !== this.#run) throw OVERTAKEN;
    };
    try {
      await this.#animate(this.#part('.scroll-body'), [
        { opacity: 0, transform: 'translateY(-1.2em) scale(0.97)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 550, easing: 'ease-out' });
      go();
      await this.#unroll(false, 1150);
      go();
      await wait(200);
      await this.#write(go);
      await this.#illuminate(wax, go);
      await wait(250);
      go();
      await this.#pour(go);
      await wait(350);
      go();
      await this.#press(wax, go);
      go();
      this.settle('open');
    } catch (error) {
      if (error !== OVERTAKEN) throw error;
    }
  }

  /** Rolls the open charter up, or unrolls the rolled one. */
  async toggle(): Promise<void> {
    const from = this.state;
    if (from === 'playing') return;
    const to = from === 'open' ? 'rolled' : 'open';
    if (reducedMotion()) return this.settle(to);
    const run = ++this.#run;
    await (from === 'open' ? this.#rollUp(850) : this.#unroll(true, 850));
    if (run === this.#run) this.settle(to);
  }

  // — the moves ——————————————————————————————————————————————————————————————————————

  #unroll(sealed: boolean, ms: number): Promise<unknown> {
    const o = { duration: ms, easing: EASE };
    return Promise.all([
      this.#animate(this.#part('[data-sheet]'), [{ clipPath: ROLLED }, { clipPath: UNROLLED }], o),
      this.#animate(this.#part('.scroll-curl-top'), [{ opacity: 1, transform: TOP_WOUND }, { opacity: 1, transform: 'none' }], o),
      this.#animate(this.#part('.scroll-curl-bottom'), [{ opacity: 1, transform: BOTTOM_WOUND }, { opacity: 1, transform: 'none' }], o),
      // the roll lifts off the two ends lying beneath it before they move apart
      this.#animate(this.#part('.scroll-roll'), [{ opacity: 1 }, { opacity: 0, offset: 0.2 }, { opacity: 0 }], { duration: ms }),
      sealed
        ? Promise.all([
            this.#animate(this.#part('.scroll-wind'), [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: ms * 0.2 }),
            this.#animate(this.#part('[data-spot]'), [{ transform: 'none' }, { transform: AT_THE_FOOT }], o),
          ])
        : this.#animate(this.#part('.scroll-cords'), [{ opacity: 0 }, { opacity: 1 }], { duration: ms * 0.4, delay: ms * 0.6 }),
    ]);
  }

  #rollUp(ms: number): Promise<unknown> {
    const o = { duration: ms, easing: EASE };
    return Promise.all([
      this.#animate(this.#part('[data-sheet]'), [{ clipPath: UNROLLED }, { clipPath: ROLLED }], o),
      this.#animate(this.#part('.scroll-curl-top'), [{ opacity: 1, transform: 'none' }, { opacity: 1, transform: TOP_WOUND }], o),
      this.#animate(this.#part('.scroll-curl-bottom'), [{ opacity: 1, transform: 'none' }, { opacity: 1, transform: BOTTOM_WOUND }], o),
      // the roll settles over the two ends once they lie side by side
      this.#animate(this.#part('.scroll-roll'), [{ opacity: 0 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }], { duration: ms }),
      this.#animate(this.#part('[data-spot]'), [{ transform: AT_THE_FOOT }, { transform: 'none' }], o),
      this.#animate(this.#part('.scroll-wind'), [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], {
        duration: ms * 0.25,
        delay: ms * 0.85,
        easing: 'ease-out',
      }),
    ]);
  }

  /** The librarian writes the day, letter by letter, the quill following the ink; then the paraph. */
  async #write(go: () => void): Promise<void> {
    const pen = this.#part('[data-quill]');
    const page = this.#part('.scroll-writing');
    const letters = [...this.#root.querySelectorAll<HTMLElement>('.scroll-ch')];
    const per = Math.max(9, Math.min(26, 3000 / Math.max(1, letters.length)));
    pen.style.opacity = '1';
    let line: Element | null = null;
    for (const letter of letters) {
      go();
      const its = letter.closest('p');
      if (line && its !== line) await wait(190);
      line = its;
      letter.classList.add('scroll-ch-on');
      // Where the letter ends, measured from the writing itself: a line's ink filter makes
      // it the letters' offset parent, and the book may be scaled by the camera.
      const box = page.getBoundingClientRect();
      const at = letter.getBoundingClientRect();
      const scale = box.width / page.offsetWidth || 1;
      const x = (at.right - box.left) / scale;
      const y = (at.bottom - box.top) / scale;
      pen.style.transform = `translate(${x - 2}px, ${y - pen.offsetHeight + Math.sin(x / 5) * 2.5}px)`;
      await wait(per);
    }
    const paraph = this.#part('[data-paraph]');
    paraph.classList.add('scroll-drawn');
    void this.#animate(paraph.querySelector('path')!, [{ strokeDashoffset: 160 }, { strokeDashoffset: 0 }], {
      duration: 520,
      easing: 'ease-in-out',
    });
    await wait(560);
    pen.style.opacity = '0';
  }

  /** The rubricator's turn: the initial, painted — and gilded on a fine day. */
  async #illuminate(wax: Wax, go: () => void): Promise<void> {
    const initial = this.#part('[data-initial]');
    initial.classList.add('scroll-painted');
    await this.#animate(initial, [
      { opacity: 0, filter: 'blur(1.5px)' },
      { opacity: 1, filter: 'blur(0px)' },
    ], { duration: 650, easing: 'ease-out' });
    go();
    if (isGold(wax)) {
      initial.classList.add('scroll-gilding');
      await wait(700);
    }
  }

  /** A taper cast in the day's wax rises from below, tips, lets four drops fall, and sinks away. */
  async #pour(go: () => void): Promise<void> {
    const candle = this.#part('.candle');
    const tilt = this.#part('.candle-tilt');
    const flame = this.#part('.candle-flame');
    const drip = this.#part('.wax-drip');
    const puddle = this.#part('.wax-seal');
    void this.#animate(candle, [
      { opacity: 1, transform: 'translateY(18em)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 1000, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' });
    await wait(1000);
    go();
    const tip = (from: number, to: number, duration: number) =>
      Promise.all([
        this.#animate(tilt, [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${to}deg)` }], { duration, easing: EASE }),
        // the flame stands upright, whichever way the taper leans
        this.#animate(flame, [{ transform: `rotate(${-from}deg)` }, { transform: `rotate(${-to}deg)` }], { duration, easing: EASE }),
      ]);
    await tip(0, -108, 650);
    go();
    let size = 0;
    for (const next of [0.32, 0.56, 0.8, 0.9]) {
      await wait(size === 0 ? 250 : 120);
      await this.#animate(drip, [
        { opacity: 1, transform: 'translate(0, 0) scale(0.5, 0.6)' },
        { opacity: 1, transform: 'translate(-0.45em, 1.2em) scale(0.8, 1.25)', offset: 0.35 },
        { opacity: 1, transform: 'translate(-1.4em, 3.6em) scale(0.9, 1.1)' },
      ], { duration: 360, easing: 'cubic-bezier(0.5, 0, 1, 0.6)', fill: 'none' });
      go();
      void this.#animate(puddle, [
        { transform: `scale(${size})` },
        { transform: `scale(${next * 1.08})` },
        { transform: `scale(${next})` },
      ], { duration: 320, easing: 'ease-out' });
      size = next;
    }
    await wait(200);
    go();
    await tip(-108, 0, 550);
    go();
    void this.#animate(candle, [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(14em)' },
    ], { duration: 850, easing: 'cubic-bezier(0.6, 0, 0.8, 0.4)' });
  }

  /** The bronze matrix comes down, its shadow tightening as it lands, and lifts off the impression. */
  async #press(wax: Wax, go: () => void): Promise<void> {
    const high = (x: number, y: number, scale: number, shadow: string, opacity = 1) => ({
      opacity,
      transform: `translate(${x}em, ${y}em) scale(${scale})`,
      filter: `drop-shadow(${shadow})`,
    });
    const down = { opacity: 1, transform: 'none', filter: 'drop-shadow(0.08em 0.12em 0.1em rgb(0 0 0 / 0.6))' };
    void this.#animate(this.#part('.wax-matrix'), [
      high(1.6, -2.6, 1.5, '1.6em 2.4em 0.9em rgb(0 0 0 / 0.25)', 0),
      { ...high(0.9, -1.5, 1.3, '1em 1.6em 0.7em rgb(0 0 0 / 0.32)'), offset: 0.2 },
      { ...down, offset: 0.45 },
      { ...down, offset: 0.62 },
      { ...high(0.8, -1.4, 1.25, '1em 1.5em 0.7em rgb(0 0 0 / 0.3)'), offset: 0.85 },
      high(1.4, -2.4, 1.45, '1.5em 2.3em 0.9em rgb(0 0 0 / 0.2)', 0),
    ], { duration: 1500, easing: EASE, fill: 'none' });
    await wait(680);
    go();
    void this.#animate(this.#part('.wax-seal'), [
      { transform: 'scale(0.9)' },
      { transform: 'scale(1.05)' },
      { transform: 'scale(1)' },
    ], { duration: 320, easing: 'ease-out' });
    await wait(260);
    go();
    void this.#animate(this.#part('[data-impression]'), [{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    await wait(500);
    go();
    if (isGold(wax)) {
      this.#sweep();
      this.#dust();
      await wait(1800);
    } else {
      await wait(600);
    }
  }

  /** The candlelight slides across the gold relief, the way metal takes it. */
  #sweep(): void {
    const lights = [...this.#root.querySelectorAll('[data-sweep]')];
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / 1700);
      const azimuth = 225 + Math.sin(t * Math.PI * 2) * 55 * (1 - t);
      const elevation = 40 + Math.sin(t * Math.PI) * 18;
      for (const light of lights) {
        light.setAttribute('azimuth', azimuth.toFixed(1));
        light.setAttribute('elevation', elevation.toFixed(1));
      }
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /** Dust, rising gold in the candlelight. */
  #dust(): void {
    const random = seeded(99);
    this.#part('[data-motes]').replaceChildren(
      ...Array.from({ length: 16 }, (_, i) => {
        const mote = document.createElement('span');
        mote.style.setProperty('--s', `${(0.12 + random() * 0.16).toFixed(2)}em`);
        mote.style.setProperty('--dx', `${((random() - 0.5) * 7).toFixed(2)}em`);
        mote.style.setProperty('--dy', `${(-3 - random() * 5).toFixed(2)}em`);
        mote.style.animationDelay = `${Math.round(i * 70 + random() * 200)}ms`;
        mote.style.animationDuration = `${Math.round(2200 + random() * 1200)}ms`;
        return mote;
      }),
    );
  }

  // — plumbing ———————————————————————————————————————————————————————————————————————

  #animate(element: Element, frames: Keyframe[], options: KeyframeAnimationOptions): Promise<unknown> {
    return element.animate(frames, { fill: 'forwards', ...options }).finished.catch(() => undefined);
  }

  /** Drops the animations this scene started; the CSS's own (the flame, the dust) run on. */
  #drop(): void {
    for (const animation of this.#root.getAnimations({ subtree: true })) {
      if (animation instanceof CSSAnimation || animation instanceof CSSTransition) continue;
      animation.cancel();
    }
  }

  #lines(): HTMLElement[] {
    return [...this.#root.querySelectorAll<HTMLElement>('[data-line]')].filter((line) => !line.closest('[hidden]'));
  }

  #part<E extends Element = HTMLElement>(selector: string): E {
    const found = this.#root.querySelector<E>(selector);
    if (!found) throw new Error(`scroll: missing ${selector}`);
    return found;
  }
}

/**
 * Splits a line into one span per letter, each a little uneven in weight and height as a
 * hand writes, words kept whole so the line still wraps where it would. `textContent` reads
 * the same.
 */
function splitIntoLetters(line: HTMLElement, random: () => number): void {
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
      letter.style.setProperty('--a', (0.8 + random() * 0.2).toFixed(2));
      letter.style.setProperty('--j', `translateY(${((random() - 0.5) * 0.07).toFixed(3)}em) rotate(${((random() - 0.5) * 2.4).toFixed(1)}deg)`);
      whole.append(letter);
    }
    parts.push(whole);
  });
  line.replaceChildren(...parts);
}

/** The outline of a pool of wax: a circle, wobbled, smoothed into curves. */
function blob(radius: number, seed: number): string {
  const random = seeded(seed);
  const phase = [random() * 6.28, random() * 6.28, random() * 6.28] as const;
  const n = 30;
  const points = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const k = 1 + 0.055 * Math.sin(3 * t + phase[0]) + 0.035 * Math.sin(5 * t + phase[1]) + 0.022 * Math.sin(9 * t + phase[2]);
    return [Math.cos(t) * radius * k, Math.sin(t) * radius * k] as const;
  });
  const at = (i: number) => points[(i + n) % n]!;
  const f = (v: number) => v.toFixed(2);
  let d = `M${f(at(0)[0])},${f(at(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} `;
    d += `${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return `${d}Z`;
}

/** A goose quill: a horn shaft, a vane of fine barbs, an inked nib. */
function quill(): SVGSVGElement {
  const random = seeded(11);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  const path = (d: string, attributes: Record<string, string>) => {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    for (const [name, value] of Object.entries(attributes)) p.setAttribute(name, value);
    svg.append(p);
  };
  path('M22 41 C30 26 44 12 62 2 C54 18 42 32 26 44 Z', { fill: '#efe7d4', opacity: '0.85' });
  for (let i = 0; i < 46; i++) {
    const t = 0.3 + (i / 46) * 0.68;
    const x = 6 + t * 54;
    const y = 58 - t * 54;
    const length = 4 + Math.sin(t * Math.PI) * 9 + random() * 1.5;
    const side = i % 2 ? 1 : -1;
    const dx = side > 0 ? length * 0.85 : -length * 0.25;
    const dy = side > 0 ? length * 0.35 : -length * 0.9;
    path(`M${x.toFixed(1)} ${y.toFixed(1)} q${(dx * 0.5).toFixed(1)} ${(dy * 0.4).toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)}`, {
      stroke: side > 0 ? '#e9e1cf' : '#d6ccb6',
      'stroke-opacity': (0.55 + random() * 0.4).toFixed(2),
      'stroke-width': '0.9',
      fill: 'none',
    });
  }
  path('M4 61 C20 45 40 22 62 2', { stroke: '#c9b48a', 'stroke-width': '1.6', fill: 'none' });
  path('M2 63 L7 57', { stroke: '#1d120a', 'stroke-width': '2.4', 'stroke-linecap': 'round' });
  return svg;
}
