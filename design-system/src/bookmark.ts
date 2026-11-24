import { between, n, pick, seeded, type Rng } from './paint';

/*
 * A bookmark: a slim card painted with a forest — autumn at dusk, pines in the morning
 * mist, or woods under the moon — framed in gilt, with a notched tail and a silk tassel
 * on a cord through an eyelet at the top. Pure string output, like the card scenes: the
 * same seed paints the same bookmark, so each book keeps its own.
 *
 * Geometry, in SVG units: the card is 60 wide and `length` long (240 by default) at the
 * origin. A longer card gets more sky and taller trees; the woods stay at its foot. The cord
 * and tassel spill out above it and to its left: the viewBox reaches TASSEL_X units left and
 * TASSEL_Y up.
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

/** A colour between two hex colours: t = 0 is `a`, 1 is `b`. */
function mix(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const value = (i: number) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t);
  return `#${[0, 1, 2].map((i) => value(i).toString(16).padStart(2, '0')).join('')}`;
}

/** How much of a card the woods take: all of a short card's foot, about 40% of a long one. */
const woodsDepth = (length: number): number => Math.max(120, length * 0.42);

const GILT = '#d8b46a';
const GILT_DARK = '#8f6d2c';

/** The card's outline: rounded at the top, a swallowtail notch at the foot. */
const outline = (length: number) => `M0 4Q0 0 4 0H56Q60 0 60 4V${n(length)}L30 ${n(length - 16)}L0 ${n(length)}Z`;
const inner = (length: number) => `M4 7Q4 4 7 4H53Q56 4 56 7V${n(length - 8)}L30 ${n(length - 21)}L4 ${n(length - 8)}Z`;

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
function row(rng: Rng, base: number, height: number, color: string, palette: Palette, leafy: boolean, length: number): string {
  const trees: string[] = [];
  for (let x = between(rng, -6, 2); x < CARD_W + 8; x += between(rng, 7, 13)) {
    const h = height * between(rng, 0.75, 1.2);
    // Taller trees grow slender, not broader: a card is only 60 wide.
    const w = Math.min(h * between(rng, 0.42, 0.55), between(rng, 18, 24));
    trees.push(
      leafy && rng() < 0.4
        ? broadleaf(x, base, h, w, color, pick(rng, palette.leaves))
        : pine(x, base, h, w, color),
    );
  }
  // The ground the row stands on, so no sky shows between the trunks.
  trees.push(`<rect x="-2" y="${n(base - 0.5)}" width="${CARD_W + 4}" height="${n(length - base + 1)}" fill="${color}"/>`);
  return trees.join('');
}

function hills(rng: Rng, base: number, color: string, length: number, rise = 1, opacity = 1): string {
  let d = `M-2 ${n(base)}`;
  for (let x = 0; x <= CARD_W + 10; x += 10) {
    d += `Q${n(x - 5)} ${n(base - between(rng, 6, 16) * rise)} ${n(x)} ${n(base - between(rng, 0, 6) * rise)}`;
  }
  return `<path d="${d}V${n(length)}H-2Z" fill="${color}"${opacity === 1 ? '' : ` opacity="${n(opacity)}"`}/>`;
}

/** The sky over the woods: everything above the hills, however long the card. */
function sky(rng: Rng, wood: BookmarkWood, palette: Palette, id: string, length: number): string {
  const parts = [`<rect width="${CARD_W}" height="${n(length)}" fill="url(#${id}-sky)"/>`];
  const horizon = length - woodsDepth(length); // the top of the woods, give or take
  const cx = between(rng, 18, 42);
  // Low in the sky, over the hills: a long card keeps its sun or moon near the woods.
  const cy = horizon - between(rng, 38, 56);
  if (wood === 'moonlit') {
    const stars = Math.round(14 * (horizon / 120));
    for (let i = 0; i < stars; i++) {
      parts.push(`<circle cx="${n(between(rng, 3, 57))}" cy="${n(between(rng, 44, horizon))}" r="${n(between(rng, 0.3, 0.8))}" fill="#fff6dc" opacity="${n(between(rng, 0.5, 1))}"/>`);
    }
    parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="8" fill="${palette.light}"/><circle cx="${n(cx + 3)}" cy="${n(cy - 2)}" r="7" fill="${palette.sky[0]}" opacity=".9"/>`);
  } else {
    parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${wood === 'mist' ? 11 : 9}" fill="${palette.light}" opacity="${wood === 'mist' ? 0.75 : 0.95}"/>`);
    // Birds on the wing.
    const birds = Math.max(3, Math.round(3 * (horizon / 120)));
    for (let i = 0; i < birds; i++) {
      const bx = between(rng, 10, 50);
      const by = between(rng, 50, horizon - 20);
      parts.push(`<path d="M${n(bx - 2.4)} ${n(by)}q1.2-1.4 2.4 0q1.2-1.4 2.4 0" fill="none" stroke="${palette.rows[2]}" stroke-width=".6" opacity=".7"/>`);
    }
  }
  return parts.join('');
}

/** Leaves on their way down, in autumn; motes of mist and fireflies otherwise. */
function drift(rng: Rng, wood: BookmarkWood, palette: Palette, length: number): string {
  const parts: string[] = [];
  // Leaves fall the length of a long card; fireflies keep to the woods.
  const top = wood === 'autumn' ? Math.max(120, length * 0.35) : length - woodsDepth(length);
  const count = wood === 'autumn' ? Math.max(6, Math.round(length / 40)) : 6;
  for (let i = 0; i < count; i++) {
    const x = between(rng, 6, 54);
    const y = between(rng, top, length - 40);
    if (wood === 'autumn') {
      parts.push(`<ellipse cx="${n(x)}" cy="${n(y)}" rx="1.6" ry=".8" transform="rotate(${n(between(rng, 0, 180))} ${n(x)} ${n(y)})" fill="${pick(rng, palette.leaves)}"/>`);
    } else if (wood === 'moonlit') {
      parts.push(`<circle cx="${n(x)}" cy="${n(y)}" r=".7" fill="#f6dc7a" opacity=".85"/>`);
    }
  }
  if (wood === 'mist') {
    const depth = woodsDepth(length);
    for (const at of [0.85, 0.62, 0.4]) {
      const y = length - depth * at;
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

/**
 * Paints the bookmark a seed picks — its woods, its trees, its silk — `length` units long
 * (60 wide; at least CARD_H). The seed alone decides the woods; the length only the room.
 */
export function renderBookmark(seed: number, length: number = CARD_H): BookmarkPainting {
  const L = Math.max(CARD_H, Math.round(length));
  // Taller trees on a longer card, so the woods keep their weight on it.
  const k = Math.min(2.2, Math.sqrt(L / CARD_H));
  const rng = seeded(seed);
  const wood = BOOKMARK_WOODS[Math.floor(rng() * BOOKMARK_WOODS.length)] ?? 'autumn';
  const palette = PALETTES[wood];
  const id = `bookmark-${seed >>> 0}-${L}`;
  const [top, middle, bottom] = palette.sky;
  const defs =
    `<clipPath id="${id}-card"><path d="${outline(L)}"/></clipPath>` +
    `<linearGradient id="${id}-sky" x1="0" x2="0" y1="0" y2="1"><stop offset=".15" stop-color="${top}"/><stop offset=".45" stop-color="${middle}"/><stop offset=".7" stop-color="${bottom}"/></linearGradient>` +
    `<linearGradient id="${id}-sheen" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".25" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>`;
  // The woods: rows of trees from the hills down to the foot, the far ones paler and smaller.
  // A short card has three rows; a long one more, and a range of mountains behind.
  const depth = woodsDepth(L);
  const count = Math.min(6, 3 + Math.floor((L - CARD_H) / 160));
  const rows: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 1 : i / (count - 1); // 0 far … 1 near
    const base = L - 18 - (depth - 46) * (1 - t) * 0.82;
    const color = t < 0.5 ? mix(palette.rows[0], palette.rows[1], t * 2) : mix(palette.rows[1], palette.rows[2], (t - 0.5) * 2);
    rows.push(row(rng, base, (26 + 18 * t) * k, color, palette, i > 0, L));
    if (i === count - 2) rows.push(drift(rng, wood, palette, L));
  }
  const painting = [
    sky(rng, wood, palette, id, L),
    L > CARD_H * 1.5 ? hills(rng, L - depth - 6, palette.far, L, 2.4 * k, 0.55) : '',
    hills(rng, L - depth + 12, palette.far, L),
    ...rows,
    `<rect x="-2" y="${n(L - 14)}" width="${CARD_W + 4}" height="20" fill="${palette.ground}"/>`,
    `<rect width="${CARD_W}" height="${n(L)}" fill="url(#${id}-sheen)"/>`,
  ].join('');
  const frame =
    `<path d="${inner(L)}" fill="none" stroke="${GILT}" stroke-width="1.1"/>` +
    `<path d="${outline(L)}" fill="none" stroke="${GILT_DARK}" stroke-width="1.2"/>` +
    // the eyelet the cord runs through
    `<circle cx="30" cy="6" r="2.8" fill="${palette.ground}" stroke="${GILT}" stroke-width="1.2"/>`;
  const viewBox = `${-TASSEL_X} ${-TASSEL_Y} ${CARD_W + TASSEL_X} ${L + TASSEL_Y}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true" focusable="false">` +
    `<defs>${defs}</defs>` +
    `<g class="ds-bookmark-card"><g clip-path="url(#${id}-card)">${painting}</g>${frame}</g>` +
    `${tassel(palette)}</svg>`;
  return { wood, svg };
}
