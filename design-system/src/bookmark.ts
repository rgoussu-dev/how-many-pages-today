import { between, n, pick, seeded, type Rng } from './paint';

/*
 * A bookmark: a slim card painted with a forest — autumn at dusk, pines in the morning
 * mist, or woods under the moon — framed in gilt, with a notched tail and a silk tassel
 * on a cord through an eyelet at the top. Pure string output, like the card scenes: the
 * same seed paints the same bookmark, so each book keeps its own.
 *
 * Geometry, in SVG units: the card is 60 × 240 at the origin. The cord and tassel spill
 * out above it and to its left, so the viewBox reaches TASSEL_X units left and TASSEL_Y up.
 */

export const BOOKMARK_WOODS = ['autumn', 'mist', 'moonlit'] as const;
export type BookmarkWood = (typeof BOOKMARK_WOODS)[number];

export interface BookmarkPainting {
  readonly wood: BookmarkWood;
  readonly svg: string;
}

export const CARD_W = 60;
export const CARD_H = 240;
/** How far the cord and tassel reach beyond the card: left, and up. */
export const TASSEL_X = 40;
export const TASSEL_Y = 24;

interface Palette {
  readonly sky: readonly [string, string, string];
  readonly light: string;
  readonly far: string;
  /** Back to front: each row of trees darker than the last. */
  readonly rows: readonly [string, string, string];
  /** Autumn foliage among the trees. */
  readonly leaves: readonly string[];
  readonly ground: string;
  readonly silk: string;
  readonly silkDark: string;
}

const PALETTES: Record<BookmarkWood, Palette> = {
  autumn: {
    sky: ['#f6d79a', '#e8a06a', '#a9563e'],
    light: '#fdeab2',
    far: '#bd7a58',
    rows: ['#9f5a3b', '#743923', '#45210f'],
    leaves: ['#dd8a2c', '#bb4b29', '#e6b43f', '#9c2f1f'],
    ground: '#34190c',
    silk: '#8e1f1a',
    silkDark: '#4f0d0a',
  },
  mist: {
    sky: ['#efe9d3', '#d4dcc5', '#a7baa3'],
    light: '#fbf6e2',
    far: '#a5b8a1',
    rows: ['#7a957a', '#4f6e55', '#2d4533'],
    leaves: ['#c99d48', '#a8582b', '#7f9150'],
    ground: '#223326',
    silk: '#2f4a32',
    silkDark: '#14261a',
  },
  moonlit: {
    sky: ['#1a2140', '#2b3259', '#4b4468'],
    light: '#f3e8c6',
    far: '#3b3c5e',
    rows: ['#30365a', '#202642', '#13172a'],
    leaves: ['#7b4b3a', '#9e6c3a', '#5c6b4b'],
    ground: '#0c0e1d',
    silk: '#b98a32',
    silkDark: '#6e4f18',
  },
};

const GILT = '#d8b46a';
const GILT_DARK = '#8f6d2c';

/** The card's outline: rounded at the top, a swallowtail notch at the foot. */
const OUTLINE = `M0 4Q0 0 4 0H56Q60 0 60 4V${CARD_H}L30 ${CARD_H - 16}L0 ${CARD_H}Z`;
const INNER = `M4 7Q4 4 7 4H53Q56 4 56 7V${CARD_H - 8}L30 ${CARD_H - 21}L4 ${CARD_H - 8}Z`;

function pine(x: number, base: number, height: number, width: number, color: string): string {
  const tiers = [0, 0.3, 0.55].map((at, i) => {
    const top = base - height + at * height;
    const w = width * (1 - i * 0.22);
    const bottom = top + height * 0.5;
    return `M${n(x)} ${n(top)}L${n(x + w / 2)} ${n(bottom)}H${n(x - w / 2)}Z`;
  });
  return `<path d="${tiers.join('')}M${n(x - 0.8)} ${n(base - height * 0.12)}h1.6V${n(base)}h-1.6Z" fill="${color}"/>`;
}

function broadleaf(x: number, base: number, height: number, width: number, trunk: string, crown: string): string {
  const cy = base - height * 0.62;
  return (
    `<rect x="${n(x - 0.9)}" y="${n(cy)}" width="1.8" height="${n(base - cy)}" fill="${trunk}"/>` +
    `<ellipse cx="${n(x)}" cy="${n(cy)}" rx="${n(width / 2)}" ry="${n(height * 0.36)}" fill="${crown}"/>` +
    `<ellipse cx="${n(x - width * 0.18)}" cy="${n(cy - height * 0.12)}" rx="${n(width * 0.28)}" ry="${n(height * 0.2)}" fill="${crown}"/>`
  );
}

/** A row of trees standing on `base`, of roughly `height`; foliage only in some rows. */
function row(rng: Rng, base: number, height: number, color: string, palette: Palette, leafy: boolean): string {
  const trees: string[] = [];
  for (let x = between(rng, -6, 2); x < CARD_W + 8; x += between(rng, 7, 13)) {
    const h = height * between(rng, 0.75, 1.2);
    const w = h * between(rng, 0.42, 0.55);
    trees.push(
      leafy && rng() < 0.45
        ? broadleaf(x, base, h, w, color, pick(rng, palette.leaves))
        : pine(x, base, h, w, color),
    );
  }
  // The ground the row stands on, so no sky shows between the trunks.
  trees.push(`<rect x="-2" y="${n(base - 0.5)}" width="${CARD_W + 4}" height="${n(CARD_H - base + 1)}" fill="${color}"/>`);
  return trees.join('');
}

function hills(rng: Rng, base: number, color: string): string {
  let d = `M-2 ${n(base)}`;
  for (let x = 0; x <= CARD_W + 10; x += 10) d += `Q${n(x - 5)} ${n(base - between(rng, 6, 16))} ${n(x)} ${n(base - between(rng, 0, 6))}`;
  return `<path d="${d}V${CARD_H}H-2Z" fill="${color}"/>`;
}

function sky(rng: Rng, wood: BookmarkWood, palette: Palette, id: string): string {
  const parts = [`<rect width="${CARD_W}" height="${CARD_H}" fill="url(#${id}-sky)"/>`];
  const cx = between(rng, 18, 42);
  const cy = between(rng, 64, 82);
  if (wood === 'moonlit') {
    for (let i = 0; i < 14; i++) {
      parts.push(`<circle cx="${n(between(rng, 3, 57))}" cy="${n(between(rng, 44, 120))}" r="${n(between(rng, 0.3, 0.8))}" fill="#fff6dc" opacity="${n(between(rng, 0.5, 1))}"/>`);
    }
    parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="8" fill="${palette.light}"/><circle cx="${n(cx + 3)}" cy="${n(cy - 2)}" r="7" fill="${palette.sky[0]}" opacity=".9"/>`);
  } else {
    parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${wood === 'mist' ? 11 : 9}" fill="${palette.light}" opacity="${wood === 'mist' ? 0.75 : 0.95}"/>`);
    // Birds on the wing.
    for (let i = 0; i < 3; i++) {
      const bx = between(rng, 10, 50);
      const by = between(rng, 50, 100);
      parts.push(`<path d="M${n(bx - 2.4)} ${n(by)}q1.2-1.4 2.4 0q1.2-1.4 2.4 0" fill="none" stroke="${palette.rows[2]}" stroke-width=".6" opacity=".7"/>`);
    }
  }
  return parts.join('');
}

/** Leaves on their way down, in autumn; motes of mist and fireflies otherwise. */
function drift(rng: Rng, wood: BookmarkWood, palette: Palette): string {
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const x = between(rng, 6, 54);
    const y = between(rng, 120, 200);
    if (wood === 'autumn') {
      parts.push(`<ellipse cx="${n(x)}" cy="${n(y)}" rx="1.6" ry=".8" transform="rotate(${n(between(rng, 0, 180))} ${n(x)} ${n(y)})" fill="${pick(rng, palette.leaves)}"/>`);
    } else if (wood === 'moonlit') {
      parts.push(`<circle cx="${n(x)}" cy="${n(y)}" r=".7" fill="#f6dc7a" opacity=".85"/>`);
    }
  }
  if (wood === 'mist') {
    for (const y of [138, 166, 192]) {
      parts.push(`<rect x="-2" y="${n(y + between(rng, -4, 4))}" width="${CARD_W + 4}" height="${n(between(rng, 6, 10))}" fill="#f3efe0" opacity=".35"/>`);
    }
  }
  return parts.join('');
}

/** The silk cord through the eyelet, draped to the left, ending in a tassel. */
function tassel(palette: Palette): string {
  const cord = `<path d="M30 6C30 -10 20 -20 6 -20S-18 -12 -26 -2" fill="none" stroke="${palette.silk}" stroke-width="2" stroke-linecap="round"/>`;
  const knot = `<ellipse cx="-27" cy="1" rx="3.4" ry="3" fill="${palette.silk}"/><ellipse cx="-28" cy="0" rx="1.4" ry="1" fill="#fff" opacity=".25"/>`;
  const strands = Array.from({ length: 7 }, (_, i) => {
    const x = -31 + i * 1.35;
    return `<path d="M${n(x)} 3Q${n(x - 0.6 + i * 0.1)} 16 ${n(x - 1 + i * 0.3)} 27" fill="none" stroke="${i % 2 ? palette.silk : palette.silkDark}" stroke-width="1.3" stroke-linecap="round"/>`;
  }).join('');
  const band = `<rect x="-31.5" y="5" width="9.5" height="2.4" rx="1" fill="${GILT}"/>`;
  return `<g>${cord}${strands}${knot}${band}</g>`;
}

/** Paints the bookmark a seed picks: its woods, its trees, its silk. */
export function renderBookmark(seed: number): BookmarkPainting {
  const rng = seeded(seed);
  const wood = BOOKMARK_WOODS[Math.floor(rng() * BOOKMARK_WOODS.length)] ?? 'autumn';
  const palette = PALETTES[wood];
  const id = `bookmark-${seed >>> 0}`;
  const [top, middle, bottom] = palette.sky;
  const defs =
    `<clipPath id="${id}-card"><path d="${OUTLINE}"/></clipPath>` +
    `<linearGradient id="${id}-sky" x1="0" x2="0" y1="0" y2="1"><stop offset=".15" stop-color="${top}"/><stop offset=".45" stop-color="${middle}"/><stop offset=".7" stop-color="${bottom}"/></linearGradient>` +
    `<linearGradient id="${id}-sheen" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".25" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>`;
  const painting = [
    sky(rng, wood, palette, id),
    hills(rng, 132, palette.far),
    row(rng, 160, 26, palette.rows[0], palette, false),
    row(rng, 190, 34, palette.rows[1], palette, true),
    drift(rng, wood, palette),
    row(rng, 222, 44, palette.rows[2], palette, true),
    `<rect x="-2" y="226" width="${CARD_W + 4}" height="20" fill="${palette.ground}"/>`,
    `<rect width="${CARD_W}" height="${CARD_H}" fill="url(#${id}-sheen)"/>`,
  ].join('');
  const frame =
    `<path d="${INNER}" fill="none" stroke="${GILT}" stroke-width="1.1"/>` +
    `<path d="${OUTLINE}" fill="none" stroke="${GILT_DARK}" stroke-width="1.2"/>` +
    // the eyelet the cord runs through
    `<circle cx="30" cy="6" r="2.8" fill="${palette.ground}" stroke="${GILT}" stroke-width="1.2"/>`;
  const viewBox = `${-TASSEL_X} ${-TASSEL_Y} ${CARD_W + TASSEL_X} ${CARD_H + TASSEL_Y}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true" focusable="false">` +
    `<defs>${defs}</defs>` +
    `<g class="ds-bookmark-card"><g clip-path="url(#${id}-card)">${painting}</g>${frame}</g>` +
    `${tassel(palette)}</svg>`;
  return { wood, svg };
}
