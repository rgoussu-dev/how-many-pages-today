import type {
  BookInHand,
  BookshelfPort,
  ChallengeError,
  DailyChallenge,
  DailyChallengePort,
  ReadingSnapshot,
  ReadingView,
} from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { addDays } from './format';
import { showFieldErrors, typedNumber } from './forms';
import { deviceSpeech, speech, type Messages, type Speech } from './i18n';
import { PortBoundElement } from './port-bound';
import { ScrollScene, type Wax } from './scroll-scene';

/** What was read, in words: the goal, beyond it, short of it, or a book finished. */
function readingSummary(day: DailyChallenge, t: Messages): string {
  const read = day.pagesRead ?? day.pages;
  const goal = day.pages;
  if (day.finishedBook) return t.card.summary.book(read);
  if (read > goal) return t.card.summary.beyond(read, goal);
  if (read < goal) return t.card.summary.short(read, goal);
  return t.card.summary.exact(read);
}

const hashOf = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** The wax the day is sealed in: short of the goal, the goal, beyond it, or a book finished. */
function waxOf(day: DailyChallenge): Wax {
  const read = day.pagesRead ?? day.pages;
  return day.finishedBook ? 'book' : read > day.pages ? 'beyond' : day.goalMet === false ? 'short' : 'met';
}

/** A warm note from the librarian — chosen by chance, but the same all day. */
function backCoverNote(day: DailyChallenge, bookTitle: string | null, t: Messages): string {
  const kind = waxOf(day);
  const pool = t.card.notes[kind];
  const note = pool[hashOf(`${day.day}:${kind}`) % pool.length] ?? pool[0] ?? '';
  // The summary beneath already says how many pages: the note only says how it felt.
  return kind === 'book' && bookTitle ? t.card.bookFinishedNote(bookTitle, note) : note;
}

function backCoverExtra(streak: number, achievements: ReadingSnapshot['achievements'], day: string, t: Messages): string {
  const earned = achievements.filter((a) => a.unlockedOn === day);
  if (earned.length === 1) return t.card.newBookplate(t.achievements.list[earned[0]!.id].title);
  if (earned.length > 1) return t.card.newBookplates(earned.length);
  return streak > 1 ? t.card.inARow(streak) : '';
}

/**
 * `<hmpt-today-card>` — the day's card, bound as a book.
 *
 * Closed, it waits for a tap. Opening, the camera pulls back to the closed book, which falls
 * open at the middle — the two days before, side by side — then pushes in while the last
 * of them turns over, and lands on today's page. There the reader writes the page they
 * stopped at (with no bookmark yet, the page first asks for the book and where it is marked).
 * Logged, the camera pulls back again, today's page turns, the book is turned over onto its
 * back cover, and a charter is written there, sealed in the day's wax and left open.
 *
 * Each half of the book is a panel hinged at the spine (x = 0 of the card): the left half is
 * the front board with a page on its inside; the right half is the real page, the leaves on
 * it and, underneath, the back board. The camera is a transform on `.tome`, so the hand-off
 * to the real page (and to the back cover) is seamless. Reduced motion skips the camera.
 */
export class TodayCard extends PortBoundElement {
  #challenge?: DailyChallengePort;
  #shelf?: BookshelfPort;
  #view?: ReadingView;
  #busy = false;
  /** The day whose card is waiting, closed, to be opened. */
  #closedDay: string | null = null;
  /** The day and language the closed book was laid out in. */
  #laidOut = '';
  #playing = false;
  #turning: ReturnType<typeof setTimeout> | undefined;
  /** The last day, status and pages rendered, to tell a fresh validation (or reading on) from a reload. */
  #seen: { day: string; done: boolean; read: number } | null = null;
  /** What the page field was last filled in for, so a re-render never overwrites the reader's typing. */
  #filledFor = '';
  #scroll!: ScrollScene;
  /** A tap asked to skip the ceremony before it began (while the book was still turning over). */
  #skipCeremony = false;

  protected markup(): string {
    return /* html */ `
      <div class="tome-camera">
      <!-- The open book's boards: a flat backdrop behind the 3D scene, never sorted into it. -->
      <div class="tome-boards" aria-hidden="true"></div>
      <article class="tome" aria-labelledby="today-pages">
        <!-- The right half's page block: its edges, so the book is a solid, not a sheet. -->
        <div class="tome-solid tome-solid-right" aria-hidden="true">
          <i class="tome-edge tome-edge-fore"></i><i class="tome-edge tome-edge-head"></i><i class="tome-edge tome-edge-tail"></i>
        </div>
        <div class="tome-inner">
          <p class="tome-date" data-date></p>
          <div class="tome-plate">
            <frame-pk ratio="4:3"><hmpt-ds-scene></hmpt-ds-scene></frame-pk>
          </div>
          <p class="tome-caption" data-caption></p>
          <p class="tome-pages" id="today-pages">
            <span class="tome-number" data-pages>…</span>
            <span class="tome-unit" data-unit></span>
          </p>
          <p class="tome-until" data-until hidden><span class="ribbon" aria-hidden="true"></span><span data-until-text></span></p>
          <p class="tome-hint" data-hint></p>
          <p class="tome-read" data-read-page hidden></p>

          <!-- No bookmark yet: the book on the nightstand, and the page it is marked at. -->
          <div class="tome-actions" data-book-needed hidden>
            <p class="tome-ask" data-book-ask></p>
            <form novalidate data-book-form class="tome-book-form">
              <label class="field" data-book-title><span data-t="card.book.title"></span>
                <input name="title" maxlength="120" autocomplete="off" required>
              </label>
              <p class="field-error" data-error="title"></p>
              <div class="tome-book-pages">
                <label class="field"><span data-t="card.book.bookmark"></span>
                  <input name="bookmark" type="number" inputmode="numeric" min="0" step="1" value="0">
                </label>
                <label class="field"><span><span data-t="card.book.total"></span> <em data-t="common.optional"></em></span>
                  <input name="totalPages" type="number" inputmode="numeric" min="1" step="1">
                </label>
              </div>
              <p class="field-error" data-error="bookmark"></p>
              <p class="field-error" data-error="totalPages"></p>
              <button class="btn btn-primary" type="submit" data-t="card.book.put"></button>
            </form>
          </div>

          <!-- The page the reading stopped at: the day's, or, once sealed, reading on. -->
          <div class="tome-actions" data-log hidden>
            <form novalidate data-log-form class="tome-log-form">
              <label class="tome-stop">
                <span class="tome-stop-label" data-log-label></span>
                <input class="tome-stop-page" name="stoppedAt" type="number" inputmode="numeric" step="1" required>
              </label>
              <label class="tome-check" data-last-field hidden><input type="checkbox" name="finishedBook"> <span data-t="card.lastPageCheck"></span></label>
              <p class="field-error" data-error="log" role="alert"></p>
              <button class="btn btn-primary btn-block" type="submit" data-t="card.seal"></button>
            </form>
          </div>

          <button type="button" class="btn btn-quiet" data-close-book hidden data-t="card.closeBook"></button>
          <p class="tome-folio" aria-hidden="true" data-folio></p>
        </div>
        <!-- The book's own bookmark, lying on today's page under the leaves, its top standing out of the
             book. Its holder is hinged at the spine like the rest of the right half, and turns with it. -->
        <div class="tome-marker" data-marker>
          <hmpt-ds-bookmark class="tome-bookmark" role="img" data-bookmark hidden></hmpt-ds-bookmark>
        </div>
        <!-- A few leaves between the two days before and today: they riffle over as the camera pushes in. -->
        <div class="tome-leaves" aria-hidden="true">
          <div class="tome-leaf"><div class="tome-leaf-front" data-leaf></div><div class="tome-leaf-back"></div></div>
          <div class="tome-leaf"><div class="tome-leaf-front tome-leaf-ruled"></div><div class="tome-leaf-back"></div></div>
          <div class="tome-leaf"><div class="tome-leaf-front tome-leaf-ruled"></div><div class="tome-leaf-back"></div></div>
        </div>
        <div class="tome-cover" data-open-cover role="button" tabindex="0" data-t-label="card.openCover">
          <span class="tome-cover-face">
            <span class="tome-cover-eyebrow" data-t="card.coverEyebrow"></span>
            <svg class="tome-cover-emblem" viewBox="0 0 64 44" aria-hidden="true"><path d="M32 8C26 4 18 3 6 4v32c12-1 20 0 26 4 6-4 14-5 26-4V4C46 3 38 4 32 8zM32 8v32M11 12c6-.5 11 .5 15 2.5M11 18c6-.5 11 .5 15 2.5M11 24c6-.5 11 .5 15 2.5M38 14.5c4-2 9-3 15-2.5M38 20.5c4-2 9-3 15-2.5M38 26.5c4-2 9-3 15-2.5"/></svg>
            <span class="tome-cover-date" data-cover-date></span>
            <span class="tome-cover-hint" data-t="card.tapToOpen"></span>
          </span>
          <!-- The book falls open from the middle: this half carries the day before yesterday's page. -->
          <div class="tome-cover-back" aria-hidden="true" data-cover-back></div>
          <i class="tome-edge tome-edge-fore" aria-hidden="true"></i><i class="tome-edge tome-edge-head" aria-hidden="true"></i><i class="tome-edge tome-edge-tail" aria-hidden="true"></i>
          <span class="tome-board" aria-hidden="true"><i class="tome-board-under"></i><i class="tome-board-fore"></i><i class="tome-board-head"></i><i class="tome-board-tail"></i><i class="tome-board-arc tome-board-arc-0"></i><i class="tome-board-arc tome-board-arc-1"></i><i class="tome-board-arc tome-board-arc-2"></i><i class="tome-board-arc tome-board-arc-3"></i><i class="tome-board-arc tome-board-arc-4"></i><i class="tome-board-arc tome-board-arc-5"></i></span>
        </div>
        <div class="tome-back" data-back>
          <span class="tome-board" aria-hidden="true"><i class="tome-board-under"></i><i class="tome-board-fore"></i><i class="tome-board-head"></i><i class="tome-board-tail"></i><i class="tome-board-arc tome-board-arc-0"></i><i class="tome-board-arc tome-board-arc-1"></i><i class="tome-board-arc tome-board-arc-2"></i><i class="tome-board-arc tome-board-arc-3"></i><i class="tome-board-arc tome-board-arc-4"></i><i class="tome-board-arc tome-board-arc-5"></i></span>
          <div class="tome-back-face" role="group" data-t-label="card.sealedGroup">
            <!-- The charter: written by the librarian, sealed in the day's wax, hanging on two cords. -->
            <div class="scroll" data-scroll data-state="open">
              <svg class="scroll-defs" aria-hidden="true" focusable="false">
                <defs>
                  <!-- Parchment edges: the skin's outline, never quite straight. -->
                  <filter id="hmpt-rough-edge" x="-4%" y="-4%" width="108%" height="108%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="7" result="t"/>
                    <feDisplacementMap in="SourceGraphic" in2="t" scale="7" xChannelSelector="R" yChannelSelector="G"/>
                  </filter>
                  <filter id="hmpt-rough-edge-fine" x="-4%" y="-20%" width="108%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="3" result="t"/>
                    <feDisplacementMap in="SourceGraphic" in2="t" scale="3" xChannelSelector="R" yChannelSelector="G"/>
                  </filter>
                  <!-- Iron-gall ink, soaking a little into the skin. -->
                  <filter id="hmpt-ink" x="-5%" y="-20%" width="110%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="2" result="t"/>
                    <feDisplacementMap in="SourceGraphic" in2="t" scale="1.1" xChannelSelector="R" yChannelSelector="G"/>
                  </filter>
                  <!-- Wax, lit from the upper left: a domed pool, a sunken field, raised relief. -->
                  <filter id="hmpt-wax-dome" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="b"/>
                    <feDiffuseLighting in="b" surfaceScale="7" diffuseConstant="1.1" lighting-color="#fff" result="d"><feDistantLight azimuth="225" elevation="48"/></feDiffuseLighting>
                    <feSpecularLighting in="b" surfaceScale="7" specularConstant="0.75" specularExponent="26" lighting-color="#fff4e0" result="s"><feDistantLight azimuth="225" elevation="48"/></feSpecularLighting>
                    <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1.12" result="lit"/>
                    <feComposite in="s" in2="SourceAlpha" operator="in" result="sp"/>
                    <feComposite in="lit" in2="sp" operator="arithmetic" k2="1" k3="0.6" result="o"/>
                    <feComposite in="o" in2="SourceAlpha" operator="in"/>
                  </filter>
                  <filter id="hmpt-wax-sunk" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="b"/>
                    <feDiffuseLighting in="b" surfaceScale="3" diffuseConstant="1.15" lighting-color="#fff" result="d"><feDistantLight azimuth="45" elevation="50"/></feDiffuseLighting>
                    <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1.05" result="o"/>
                    <feComposite in="o" in2="SourceAlpha" operator="in"/>
                  </filter>
                  <filter id="hmpt-wax-raised" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="0.7" result="b"/>
                    <feDiffuseLighting in="b" surfaceScale="2.2" diffuseConstant="1.1" lighting-color="#fff" result="d"><feDistantLight azimuth="225" elevation="42"/></feDiffuseLighting>
                    <feSpecularLighting in="b" surfaceScale="2.2" specularConstant="0.8" specularExponent="24" lighting-color="#fff4e0" result="s"><feDistantLight azimuth="225" elevation="42"/></feSpecularLighting>
                    <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1.12" result="lit"/>
                    <feComposite in="s" in2="SourceAlpha" operator="in" result="sp"/>
                    <feComposite in="lit" in2="sp" operator="arithmetic" k2="1" k3="0.7" result="o"/>
                    <feComposite in="o" in2="SourceAlpha" operator="in"/>
                  </filter>
                  <!-- Gold wax takes the light like metal; the light slides across it once pressed. -->
                  <filter id="hmpt-wax-raised-gold" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="0.7" result="b"/>
                    <feDiffuseLighting in="b" surfaceScale="2.4" diffuseConstant="1.05" lighting-color="#fff" result="d"><feDistantLight data-sweep azimuth="225" elevation="40"/></feDiffuseLighting>
                    <feSpecularLighting in="b" surfaceScale="2.4" specularConstant="1.3" specularExponent="34" lighting-color="#fff2c0" result="s"><feDistantLight data-sweep azimuth="225" elevation="40"/></feSpecularLighting>
                    <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1.1" result="lit"/>
                    <feComposite in="s" in2="SourceAlpha" operator="in" result="sp"/>
                    <feComposite in="lit" in2="sp" operator="arithmetic" k2="1" k3="1" result="o"/>
                    <feComposite in="o" in2="SourceAlpha" operator="in"/>
                  </filter>
                  <filter id="hmpt-metal" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="b"/>
                    <feSpecularLighting in="b" surfaceScale="4" specularConstant="1.1" specularExponent="18" lighting-color="#ffe9b8" result="s"><feDistantLight azimuth="225" elevation="45"/></feSpecularLighting>
                    <feComposite in="s" in2="SourceAlpha" operator="in" result="sp"/>
                    <feComposite in="SourceGraphic" in2="sp" operator="arithmetic" k2="1" k3="0.8"/>
                  </filter>
                  <filter id="hmpt-soft"><feGaussianBlur stdDeviation="0.9"/></filter>
                  <radialGradient id="hmpt-bronze" cx="40%" cy="35%" r="70%">
                    <stop offset="0" stop-color="#d8ad66"/><stop offset="0.45" stop-color="#9b6a2b"/><stop offset="1" stop-color="#432808"/>
                  </radialGradient>
                  <radialGradient id="hmpt-flame" cx="50%" cy="78%" r="62%">
                    <stop offset="0" stop-color="#fffbe8"/><stop offset="0.3" stop-color="#ffe39a"/><stop offset="0.62" stop-color="#ffab3a"/><stop offset="1" stop-color="#ff6a10" stop-opacity="0"/>
                  </radialGradient>
                  <radialGradient id="hmpt-flame-core" cx="50%" cy="85%" r="60%">
                    <stop offset="0" stop-color="#3f58c8" stop-opacity="0.7"/><stop offset="0.5" stop-color="#6a5aa0" stop-opacity="0.25"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
                  </radialGradient>
                  <!-- The taper: shaded as a cylinder in the day's wax, glowing where the flame lights it from within. -->
                  <linearGradient id="hmpt-taper" x1="0" x2="1">
                    <stop offset="0" class="taper-lo"/><stop offset="0.28" class="taper-mid"/><stop offset="0.46" class="taper-hi"/><stop offset="0.7" class="taper-mid"/><stop offset="1" class="taper-lo"/>
                  </linearGradient>
                  <linearGradient id="hmpt-taper-glow" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stop-color="#ffd28a" stop-opacity="0.55"/><stop offset="0.16" stop-color="#ffb060" stop-opacity="0.12"/><stop offset="0.3" stop-color="#ffb060" stop-opacity="0"/>
                  </linearGradient>
                  <path id="hmpt-legend-arc" d="M 0 -28.4 A 28.4 28.4 0 1 1 -0.01 -28.4"/>
                </defs>
              </svg>
              <div class="scroll-body">
                <i class="scroll-curl scroll-curl-top" aria-hidden="true"></i>
                <div class="scroll-sheet" data-sheet>
                  <div class="scroll-vellum" aria-hidden="true"></div>
                  <div class="scroll-writing" role="status">
                    <p class="scroll-date" data-line data-scroll-date></p>
                    <p class="scroll-head" data-head><span class="scroll-initial" data-initial><b data-initial-letter></b></span><span data-line data-head-rest></span></p>
                    <p class="scroll-line" data-line data-read></p>
                    <p class="scroll-line" data-line data-message></p>
                    <p class="scroll-line" data-line data-back-bookmark hidden></p>
                    <p class="scroll-line" data-line data-extra hidden></p>
                    <p class="scroll-sign"><span data-line data-sign data-t="card.scroll.signature"></span>
                      <svg class="scroll-paraph" data-paraph viewBox="0 0 80 14" aria-hidden="true"><path d="M2 9 C14 2 20 13 30 7 C38 2 44 12 54 6 C60 3 68 4 78 2 M60 9 C66 6 72 8 77 6"/></svg>
                    </p>
                    <span class="scroll-quill" data-quill aria-hidden="true"></span>
                  </div>
                  <button type="button" class="scroll-read-on" data-read-on><span class="scroll-hand" aria-hidden="true">☞</span><span data-t="card.scroll.readOn"></span></button>
                </div>
                <i class="scroll-curl scroll-curl-bottom" aria-hidden="true"></i>
                <span class="scroll-roll" aria-hidden="true"><i class="scroll-lip"></i><span class="scroll-wind"><i></i><i></i></span></span>
              </div>
              <div class="scroll-spot" data-spot>
                <span class="scroll-cords" aria-hidden="true"><i></i><i></i></span>
                <span class="wax-seal" aria-hidden="true">
                  <svg viewBox="-60 -60 120 120">
                    <g class="wax-puddle" data-puddle><path class="wax" data-blob filter="url(#hmpt-wax-dome)"/></g>
                    <g class="wax-impression" data-impression>
                      <circle class="wax" r="35" filter="url(#hmpt-wax-sunk)"/>
                      <g class="wax-relief">
                        <circle class="wax-line" r="33.6" stroke-width="2.2"/>
                        <circle class="wax-line" r="23.2" stroke-width="1.3"/>
                        <text class="wax-legend"><textPath href="#hmpt-legend-arc" textLength="176" lengthAdjust="spacing" data-legend></textPath></text>
                        <path class="wax" d="M0 -7 C-5 -11 -12 -11.5 -18 -9.5 V10 C-12 8 -5 8.5 0 12 C5 8.5 12 8 18 10 V-9.5 C12 -11.5 5 -11 0 -7z"/>
                      </g>
                      <path class="wax-engraving" d="M0 -7 V12 M-14 -5 C-10 -6 -6 -5.5 -3 -4 M-14 -1 C-10 -2 -6 -1.5 -3 0 M-14 3 C-10 2 -6 2.5 -3 4 M14 -5 C10 -6 6 -5.5 3 -4 M14 -1 C10 -2 6 -1.5 3 0 M14 3 C10 2 6 2.5 3 4"/>
                    </g>
                  </svg>
                </span>
                <span class="wax-matrix" aria-hidden="true">
                  <svg viewBox="-60 -60 120 120">
                    <circle r="46" fill="url(#hmpt-bronze)" filter="url(#hmpt-metal)"/>
                    <circle r="40" fill="none" stroke="#5a3a12" stroke-opacity="0.5" stroke-width="1.5"/>
                    <circle cx="-14" cy="18" r="7" fill="#4e7a5c" opacity="0.35" filter="url(#hmpt-soft)"/>
                    <circle cx="20" cy="-10" r="5" fill="#4e7a5c" opacity="0.3" filter="url(#hmpt-soft)"/>
                    <path d="M-15 4 C-15 -24 15 -24 15 4" fill="none" stroke="#7d5420" stroke-width="7" stroke-linecap="round" filter="url(#hmpt-metal)"/>
                    <path d="M-15 4 C-15 -24 15 -24 15 4" fill="none" stroke="#e4c07a" stroke-opacity="0.45" stroke-width="1.6" stroke-linecap="round" transform="translate(-1.2 -1.2)"/>
                  </svg>
                </span>
                <span class="wax-motes" data-motes aria-hidden="true"></span>
                <button type="button" class="scroll-seal" data-seal></button>
              </div>
              <span class="wax-drip" aria-hidden="true">
                <svg viewBox="-10 -14 20 28"><path class="wax" d="M0 -13 C5 -4 8 2 8 6 A8 8 0 0 1 -8 6 C-8 2 -5 -4 0 -13z"/><ellipse cx="-2.6" cy="4" rx="2" ry="3.2" fill="#fff" opacity="0.35"/></svg>
              </span>
              <span class="candle" aria-hidden="true">
                <span class="candle-tilt">
                  <span class="candle-flame">
                    <span class="candle-halo"></span>
                    <svg viewBox="-24 -60 48 68">
                      <g class="candle-lick">
                        <path d="M0 -56 C9 -38 13 -20 9 -6 C6 3 -6 3 -9 -6 C-13 -20 -9 -38 0 -56z" fill="url(#hmpt-flame)" filter="url(#hmpt-soft)"/>
                        <path d="M0 -26 C4 -18 5 -10 3.6 -5 C2.4 -1.5 -2.4 -1.5 -3.6 -5 C-5 -10 -4 -18 0 -26z" fill="url(#hmpt-flame-core)" filter="url(#hmpt-soft)"/>
                      </g>
                      <path d="M0 6 C0.5 2 -1.6 -1 0.6 -4.5" fill="none" stroke="#140c06" stroke-width="1.8" stroke-linecap="round"/>
                      <circle cx="0.6" cy="-4.8" r="1.3" fill="#ff7a1a" filter="url(#hmpt-soft)"/>
                    </svg>
                  </span>
                  <svg class="candle-body" viewBox="0 0 34 168" preserveAspectRatio="none">
                    <path d="M4 8 C6 3 10 6 13 4 C16 1 19 5 22 3 C25 2 28 5 30 8 L31.5 168 H2.5 Z" fill="url(#hmpt-taper)"/>
                    <path d="M4 8 C6 3 10 6 13 4 C16 1 19 5 22 3 C25 2 28 5 30 8 L31.5 168 H2.5 Z" fill="url(#hmpt-taper-glow)"/>
                    <path d="M6 6 C5 18 7 26 6.5 34 C6.2 39 9.5 39 9.3 34 C9 25 10 16 9.5 6z" fill="url(#hmpt-taper)" opacity="0.95"/>
                    <path d="M24 5 C24.5 12 23.5 17 24 22 C24.2 25.5 26.8 25.5 27 22 C27.3 16 26.5 10 27 6z" fill="url(#hmpt-taper)" opacity="0.95"/>
                    <path d="M15 4 C15.5 8 14.8 11 15.2 14 C15.4 16 17.4 16 17.5 14 C17.7 10 17.2 7 17.5 4z" fill="url(#hmpt-taper)" opacity="0.9"/>
                    <path d="M7 8 C7 60 8 110 7.5 166" stroke="#fff" stroke-opacity="0.12" stroke-width="1.5" fill="none"/>
                  </svg>
                </span>
              </span>
            </div>
            <p class="scroll-hint" data-scroll-hint></p>
          </div>
        </div>
      </article>
      </div>`;
  }

  protected override setup(): void {
    this.#scroll = new ScrollScene(this.$('[data-scroll]'));
    this.addEventListener('scroll-state', () => this.#syncScroll());
    const cover = this.$('[data-open-cover]');
    cover.addEventListener('click', () => void this.#open());
    cover.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void this.#open();
      }
    });

    // The back cover: a tap skips the ceremony; on the open scroll it rolls it up; the seal
    // rolls and unrolls it; "I read some more" reopens the book onto today's page.
    this.$('.tome-back-face').addEventListener('click', (event) => {
      const state = this.#scroll.state;
      if (state === 'playing' || this.hasAttribute('data-closing')) {
        if (this.hasAttribute('data-done')) this.#skip();
        return;
      }
      if (state === 'open' && !(event.target as Element).closest('button')) void this.#scroll.toggle();
    });
    this.$('[data-seal]').addEventListener('click', (event) => {
      event.stopPropagation();
      void this.#scroll.toggle();
    });
    // Reopening after the day is read: the closing, rewound; closing it again: the closing,
    // replayed. Both a little quicker than the first time.
    this.$('[data-read-on]').addEventListener('click', (event) => {
      event.stopPropagation();
      this.setAttribute('data-peek', '');
      this.#turn('reopen', () => this.$<HTMLInputElement>('[name="stoppedAt"]').focus());
    });
    this.$('[data-close-book]').addEventListener('click', () => {
      this.removeAttribute('data-peek');
      this.#turn('again', () => this.$<HTMLElement>('[data-seal]').focus());
    });

    const log = this.$<HTMLFormElement>('[data-log-form]');
    const stopped = log.elements.namedItem('stoppedAt') as HTMLInputElement;
    const last = log.elements.namedItem('finishedBook') as HTMLInputElement;
    log.addEventListener('submit', async (event) => {
      event.preventDefault();
      const entry = {
        stoppedAt: stopped.valueAsNumber,
        ...(last.checked && !this.$('[data-last-field]').hidden ? { finishedBook: true } : {}),
      };
      const readingOn = this.hasAttribute('data-done');
      const error = await this.#run((port) => (readingOn ? port.readOn(entry) : port.complete(entry)));
      const book = this.#view?.current()?.shelf.current;
      this.$('[data-error="log"]').textContent = error
        ? this.#words().t.card.errors(error, book?.bookmark ?? 0, book?.totalPages ?? null)
        : '';
      stopped.toggleAttribute('aria-invalid', error !== null);
      if (!error) last.checked = false;
    });

    const bookForm = this.$<HTMLFormElement>('[data-book-form]');
    bookForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!this.#shelf) return;
      const field = (name: string) => bookForm.elements.namedItem(name) as HTMLInputElement;
      const bookmark = typedNumber(field('bookmark')) ?? 0;
      const totalPages = typedNumber(field('totalPages'));
      const pages = { bookmark, ...(totalPages === undefined ? {} : { totalPages }) };
      const inHand = this.#view?.current()?.shelf.current;
      const result = inHand
        ? await this.#shelf.updateBook(pages)
        : await this.#shelf.startReading({ title: field('title').value, ...pages });
      showFieldErrors(bookForm, result.ok ? [] : result.error, this.#words().t);
      if (result.ok) stopped.focus();
    });
  }

  protected connect() {
    this.#challenge = this.request(readingContexts.challenge);
    this.#shelf = this.request(readingContexts.bookshelf);
    this.#view = this.request(readingContexts.view);
    return [this.#view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #words(): Speech {
    const language = this.#view?.current()?.language;
    return language ? speech(language) : deviceSpeech();
  }

  /** Runs one command at a time; returns the error, if any. */
  async #run(
    action: (port: DailyChallengePort) => Promise<{ ok: true } | { ok: false; error: ChallengeError }>,
  ): Promise<ChallengeError | null> {
    if (this.#busy || !this.#challenge) return null;
    this.#busy = true;
    try {
      const result = await action(this.#challenge);
      return result.ok ? null : result.error;
    } finally {
      this.#busy = false;
    }
  }

  /** The page is out of reach while a board covers it: the front before opening, the back once sealed. */
  #syncInert(): void {
    const onItsBack = this.hasAttribute('data-done') && !this.hasAttribute('data-peek');
    const covered = this.hasAttribute('data-reveal') || this.hasAttribute('data-closing') || onItsBack;
    this.$('.tome-inner').inert = covered;
    // Lying on its back, the book shows its bookmark at the other edge — once it has finished
    // turning over (while it turns, the bookmark has slipped out of sight).
    const bookmark = this.$('[data-bookmark]');
    if (onItsBack && !this.hasAttribute('data-closing')) bookmark.setAttribute('side', 'right');
    else bookmark.removeAttribute('side');
  }

  /** The words around the scroll follow its state: how to skip, roll or unroll it. */
  #syncScroll(): void {
    const { t } = this.#words();
    const state = this.#scroll.state;
    const playing = state === 'playing';
    this.$('[data-scroll-hint]').textContent = playing ? t.card.scroll.skip : state === 'open' ? t.card.scroll.openHint : t.card.scroll.rolledHint;
    this.$('[data-seal]').setAttribute('aria-label', state === 'open' ? t.card.scroll.rollUp : t.card.scroll.unroll);
    this.$('[data-seal]').hidden = playing;
    this.$('[data-read-on]').inert = state !== 'open';
  }

  // — opening: closed → the open book, the two days before → today's page ——————————————

  /** A card not yet opened waits closed, its spread laid out beneath the cover. */
  #arrange({ today, history, profile }: ReadingSnapshot, words: Speech): void {
    const waiting = today.unveiledAt === undefined && today.status === 'pending';
    if (!waiting) {
      if (!this.#playing) this.removeAttribute('data-reveal');
      this.#closedDay = null;
      this.#laidOut = '';
      return;
    }
    const layout = `${today.day}|${words.locale}`;
    if (this.#laidOut === layout) return;
    this.#laidOut = layout;
    this.#closedDay = today.day;
    this.$('[data-cover-date]').textContent = words.longDate(today.day);
    // The spread the camera pulls back to: the two days before today — or, in a brand-new
    // book, its front matter.
    const byDay = new Map(history.map((c) => [c.day, c]));
    const before = addDays(today.day, -2);
    const yesterday = addDays(today.day, -1);
    const fresh = !history.some((c) => c.day < today.day);
    this.$('[data-cover-back]').replaceChildren(
      fresh ? frontMatter('ex-libris', profile?.displayName ?? null, words) : pastPage(before, byDay.get(before), words),
    );
    this.$('[data-leaf]').replaceChildren(
      fresh ? frontMatter('chapter-one', null, words) : pastPage(yesterday, byDay.get(yesterday), words),
    );
    if (!this.#playing) this.setAttribute('data-reveal', 'closed');
    this.#syncInert();
  }

  async #open(): Promise<void> {
    if (this.#playing || !this.#closedDay) return;
    this.#playing = true;
    const target = Number(this.$('[data-pages]').textContent) || 0;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const number = this.$('[data-pages]');
      const folio = this.$('[data-folio]');
      const show = (n: number) => {
        number.textContent = String(n);
        folio.textContent = `— ${n} —`; // the folio turns with the page
      };
      show(1);
      this.setAttribute('data-reveal', 'opening');
      this.#syncInert();
      await wait(3300); // stand on the spine, a breath, fall open from the middle, the leaves riffle
      await countUp(show, target, 1100); // …and the count runs up as the camera pushes in
      // Hand over to the page only once the camera has come to rest: never mid-move.
      await Promise.race([finished(this.$('.tome-camera')), wait(1500)]);
      this.setAttribute('data-reveal', 'landed');
      await wait(550);
    }
    this.removeAttribute('data-reveal');
    this.#playing = false;
    this.#closedDay = null;
    this.#laidOut = '';
    this.#syncInert();
    await this.#challenge?.unveil();
  }

  // — closing: today's page → the open book → turned over onto the back cover ——————————

  /**
   * The day is logged (or logged again, reading on): the book closes and turns over, and
   * the scroll is written and sealed on its back cover.
   */
  #seal(wax: Wax, seed: number, kind: 'first' | 'again'): void {
    this.removeAttribute('data-peek');
    this.#skipCeremony = false;
    this.#scroll.hold(seed);
    this.#turn(kind, () => {
      if (this.#skipCeremony) this.#scroll.settle('open');
      else void this.#scroll.play(wax, seed);
    });
  }

  /** Skips straight to the sealed scroll, lying open. */
  #skip(): void {
    this.#skipCeremony = true;
    if (!this.hasAttribute('data-closing')) this.#scroll.settle('open');
  }

  /**
   * Plays the closing: the first time, again (closing it after a look inside), or rewound
   * (reopening it onto today's page). The state it ends in is already set; `then` runs once
   * the book is at rest.
   */
  #turn(kind: 'first' | 'again' | 'reopen', then?: () => void): void {
    clearTimeout(this.#turning);
    const settle = () => {
      this.removeAttribute('data-closing');
      this.#syncInert();
      then?.();
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return settle();
    this.$('[data-cover-back]').replaceChildren(verso()); // the left half, as the book closes
    this.removeAttribute('data-closing');
    void this.offsetWidth;
    this.setAttribute('data-closing', kind === 'first' ? '' : kind);
    this.#syncInert();
    this.#turning = setTimeout(settle, kind === 'first' ? 4450 : 3050);
  }

  /** The book in hand's own bookmark, lying in the book with the page on it, sticking out at the top. */
  #renderBookmark(book: BookInHand | null, t: Messages): void {
    const bookmark = this.$('[data-bookmark]');
    const page = book?.bookmark;
    const shown = book !== null && page !== undefined;
    bookmark.hidden = !shown;
    this.toggleAttribute('data-bookmarked', shown);
    if (!shown) return;
    // Each book keeps its own bookmark: the same woods every day until it is finished.
    bookmark.setAttribute('seed', String(hashOf(`${book.title}|${book.startedOn}`)));
    bookmark.setAttribute('mark', t.card.bookmarkTag(page));
    bookmark.setAttribute('aria-label', t.card.bookmarkLabel(book.title, page));
  }

  /** The page's fields: the book and its bookmark first if there is none, then the page reached. */
  #renderFields(snapshot: ReadingSnapshot, done: boolean, t: Messages): void {
    const book = snapshot.shelf.current;
    const marked = book !== null && book.bookmark !== undefined;
    this.$('[data-book-needed]').hidden = marked;
    this.$('[data-log]').hidden = !marked;
    this.$('[data-book-title]').hidden = book !== null;
    this.$('[data-book-ask]').textContent = book ? t.card.book.askBookmark(book.title) : t.card.book.ask;
    this.$<HTMLInputElement>('[data-book-form] [name="title"]').placeholder = t.shelf.titlePlaceholder;
    if (!marked) return;

    const log = this.$<HTMLFormElement>('[data-log-form]');
    const stopped = log.elements.namedItem('stoppedAt') as HTMLInputElement;
    this.$('[data-log-label]').textContent = done ? t.card.readOnTo : t.card.stoppedAt;
    stopped.min = String(book.bookmark! + 1);
    if (book.totalPages !== undefined) stopped.max = String(book.totalPages);
    else stopped.removeAttribute('max');
    this.$('[data-last-field]').hidden = book.totalPages !== undefined;
    // Filled in once for each day, state and bookmark: the page the card asked to reach, or —
    // reading on — left for the reader to write. Never while they are typing.
    const filledFor = `${snapshot.today.day}|${done}|${book.title}|${book.bookmark}`;
    if (this.#filledFor !== filledFor) {
      this.#filledFor = filledFor;
      stopped.value = done || snapshot.readTo === null ? '' : String(snapshot.readTo);
      this.$('[data-error="log"]').textContent = '';
    }
  }

  /** The scroll's words: the day, how it went, a note from the librarian, the bookmark, the streak. */
  #renderScroll(snapshot: ReadingSnapshot, words: Speech): void {
    const { today, stats, shelf, achievements } = snapshot;
    const { t } = words;
    const wax = waxOf(today);
    this.setAttribute('data-wax', wax);
    const write = (selector: string, text: string) => {
      const line = this.$(selector);
      line.hidden = text === '';
      if (line.textContent !== text) line.textContent = text;
    };
    write('[data-scroll-date]', words.longDate(today.day));
    // The heading is a rubric, its first letter the illuminated initial.
    const [initial = '', ...rest] = Array.from(t.card.scroll.heads[wax]);
    write('[data-initial-letter]', initial);
    write('[data-head-rest]', rest.join(''));
    write('[data-read]', readingSummary(today, t));
    write('[data-message]', backCoverNote(today, shelf.finished.at(-1)?.title ?? null, t));
    const book = shelf.current;
    write('[data-back-bookmark]', book?.bookmark ? t.card.bookmarkAt(book.bookmark, book.totalPages ?? null) : '');
    write('[data-extra]', backCoverExtra(stats.currentStreak, achievements, today.day, t));
    this.$('[data-legend]').textContent = t.card.scroll.legend;
    this.#scroll.shape(hashOf(today.day));
    this.#syncScroll();
  }

  #render(snapshot: ReadingSnapshot): void {
    const { today, stats, shelf, readTo, language } = snapshot;
    const words = this.speak(language);
    const { t } = words;
    this.#arrange(snapshot, words);
    const done = today.status === 'completed';
    this.toggleAttribute('data-done', done);
    const plate = this.$('.tome-inner hmpt-ds-scene');
    plate.setAttribute('lang', words.language);
    plate.setAttribute('seed', String(today.artSeed));
    // The plate's caption, as in an illustrated book: the scene's own description.
    this.$('[data-caption]').textContent = plate.getAttribute('aria-label') ?? '';
    this.$('[data-date]').textContent = words.longDate(today.day);
    if (!this.#playing) {
      this.$('[data-pages]').textContent = String(today.pages);
      this.$('[data-folio]').textContent = `— ${today.pages} —`;
    }
    this.$('[data-unit]').textContent = t.card.unit(today.pages);
    this.$('[data-hint]').textContent = done
      ? t.card.hintDone(stats.currentStreak)
      : (t.card.hints[today.artSeed % t.card.hints.length] ?? '');

    // The bookmark: the page today's reading leads to, and — once read — where it now sits.
    const book = shelf.current;
    this.#renderBookmark(book, t);
    const total = book?.totalPages ?? null;
    const marked = book?.bookmark !== undefined && book.bookmark > 0;
    const until = done ? (marked ? t.card.bookmarkAt(book.bookmark!, total) : '') : readTo === null ? '' : readTo === total ? t.card.toTheEnd(readTo) : t.card.upTo(readTo);
    this.$('[data-until]').hidden = until === '';
    this.$('[data-until-text]').textContent = until;
    this.#renderFields(snapshot, done, t);

    this.$('[data-read-page]').hidden = !done;
    this.$('[data-close-book]').hidden = !done;
    const read = today.pagesRead ?? today.pages;
    const seen = this.#seen;
    this.#seen = { day: today.day, done, read };
    if (!done) {
      this.removeAttribute('data-peek');
      this.#syncInert();
      return;
    }
    this.$('[data-read-page]').textContent = readingSummary(today, t);
    this.#renderScroll(snapshot, words);
    const sameDay = seen?.day === today.day;
    const seed = hashOf(`${today.day}|${read}`);
    if (sameDay && !seen.done) this.#seal(waxOf(today), seed, 'first');
    else if (sameDay && seen.read !== read) this.#seal(waxOf(today), seed, 'again');
    this.#syncInert();
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolves once the element's running animations have finished. */
const finished = (element: Element) =>
  Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined))).then(() => undefined);

/** Riffles the number from 1 up to `target`, fast at first, settling at the end. */
function countUp(show: (n: number) => void, target: number, duration: number): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      show(Math.max(1, Math.round(eased * target)));
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** A past day's page, as glimpsed in the open book: its date, its plate, what was read. */
function pastPage(day: string, card: DailyChallenge | undefined, words: Speech): HTMLElement {
  const { t } = words;
  const page = el('div', 'past-page');
  page.append(el('p', 'past-head', words.longDate(day)));
  const plate = el('div', 'past-plate');
  const frame = document.createElement('frame-pk');
  frame.setAttribute('ratio', '4:3');
  const scene = document.createElement('hmpt-ds-scene');
  scene.setAttribute('lang', words.language);
  scene.setAttribute('seed', String(card?.artSeed ?? hashOf(day)));
  frame.append(scene);
  plate.append(frame);
  page.append(plate);
  if (card?.status === 'completed') {
    const read = card.pagesRead ?? card.pages;
    page.append(el('p', 'past-number', String(read)), el('p', 'past-note', t.card.past.read(read)));
  } else if (card) {
    page.append(el('p', 'past-number past-faint', String(card.pages)), el('p', 'past-note', t.card.past.unread));
  } else {
    page.append(el('p', 'past-number past-faint', '—'), el('p', 'past-note', t.card.past.noCard));
  }
  return page;
}

/** The front matter of a brand-new book. */
function frontMatter(kind: 'ex-libris' | 'chapter-one', name: string | null, { t }: Speech): HTMLElement {
  const page = el('div', `past-page past-${kind}`);
  if (kind === 'ex-libris') {
    const plate = el('div', 'past-bookplate');
    plate.append(el('p', 'past-bookplate-title', t.card.past.exLibris), el('p', 'past-bookplate-name', name ?? t.card.past.newReader));
    page.append(plate);
  } else {
    page.append(
      el('p', 'past-chapter-eyebrow', t.card.past.chapter),
      el('p', 'past-chapter-title', t.card.past.one),
      el('p', 'past-ornament', '❦'),
    );
  }
  return page;
}

/** The back of a turned leaf: paper ruled with lines of text. */
const verso = (): HTMLElement => el('div', 'past-page past-verso');
