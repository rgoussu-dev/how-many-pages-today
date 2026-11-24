import { between, n, pick, seeded, type Rng } from './paint';

/*
 * A bookmark: a slim card painted with an autumn forest all in red, orange and gold — at
 * dusk, in a golden morning mist, or under a harvest moon — framed in gilt, with a notched tail and a silk tassel
 * on a cord through an eyelet at the top. Pure string output, like the card scenes: the
 * same seed paints the same bookmark, so each book keeps its own.
 *
 * Geometry, in SVG units: the card is 60 wide and `length` long (240 by default) at the
 * origin. A longer card gets more sky and taller trees; the woods stay at its foot. The cord
 * and tassel spill out above it and to its left: the viewBox reaches TASSEL_X units left and
 * TASSEL_Y up.
 */

export const BOOKMARK_WOODS = ['dusk', 'golden-mist', 'harvest-moon'] as const;
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
  dusk: {
    sky: ['#ffd98a', '#f59a4e', '#c2452c'],
    light: '#fff0b8',
    far: '#c8693f',
    rows: ['#c0602e', '#8f3419', '#4e170b'],
    leaves: ['#e8401f', '#f07a1a', '#f5b51e', '#c42a1b', '#ffcf3a'],
    ground: '#5a1e0c',
    silk: '#b3261a',
    silkDark: '#5e0f08',
  },
  'golden-mist': {
    sky: ['#fff1cf', '#f8d79a', '#eba86a'],
    light: '#fff8e2',
    far: '#e2a873',
    rows: ['#d58a4a', '#a9522a', '#6a2a14'],
    leaves: ['#f2b02a', '#ec7d22', '#d8461f', '#ffd34d', '#b83a1c'],
    ground: '#6b2e14',
    silk: '#d07a1a',
    silkDark: '#7a3f0a',
  },
  'harvest-moon': {
    sky: ['#2a1630', '#5a2238', '#a3402e'],
    light: '#ffb347',
    far: '#6e2a2a',
    rows: ['#8a3020', '#5e1d14', '#2e0d08'],
    leaves: ['#d9431f', '#ef7f1f', '#f2b632', '#a8261a'],
    ground: '#240a06',
    silk: '#e0a030',
    silkDark: '#7a5210',
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
  // The light catches the top of the crown.
  const lit = mix(crown, '#fff3c4', 0.3);
  return (
    `<rect x="${n(x - 0.9)}" y="${n(cy)}" width="1.8" height="${n(base - cy)}" fill="${trunk}"/>` +
    `<ellipse cx="${n(x)}" cy="${n(cy)}" rx="${n(width / 2)}" ry="${n(height * 0.36)}" fill="${crown}"/>` +
    `<ellipse cx="${n(x - width * 0.18)}" cy="${n(cy - height * 0.12)}" rx="${n(width * 0.28)}" ry="${n(height * 0.2)}" fill="${crown}"/>` +
    `<ellipse cx="${n(x + width * 0.12)}" cy="${n(cy - height * 0.2)}" rx="${n(width * 0.18)}" ry="${n(height * 0.1)}" fill="${lit}" opacity=".8"/>`
  );
}

/**
 * A row of trees standing on `base`, of roughly `height`: mostly broadleaves in their autumn
 * colours, a few russet pines. `haze` (0 near … 1 far) pales the far rows' crowns into the air.
 */
function row(rng: Rng, base: number, height: number, color: string, palette: Palette, haze: number, length: number): string {
  const trees: string[] = [];
  for (let x = between(rng, -6, 2); x < CARD_W + 8; x += between(rng, 7, 13)) {
    const h = height * between(rng, 0.75, 1.2);
    // Taller trees grow slender, not broader: a card is only 60 wide.
    const w = Math.min(h * between(rng, 0.42, 0.55), between(rng, 18, 24));
    trees.push(
      rng() < 0.75
        ? broadleaf(x, base, h, w, color, mix(pick(rng, palette.leaves), palette.far, haze))
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
  if (wood === 'harvest-moon') {
    const stars = Math.round(14 * (horizon / 120));
    for (let i = 0; i < stars; i++) {
      parts.push(`<circle cx="${n(between(rng, 3, 57))}" cy="${n(between(rng, 44, horizon))}" r="${n(between(rng, 0.3, 0.8))}" fill="#fff6dc" opacity="${n(between(rng, 0.5, 1))}"/>`);
    }
    // A big orange harvest moon, glowing over the woods.
    parts.push(
      `<circle cx="${n(cx)}" cy="${n(cy)}" r="16" fill="${palette.light}" opacity=".18"/>` +
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="11" fill="${palette.light}"/>` +
        `<circle cx="${n(cx - 3)}" cy="${n(cy - 2)}" r="2.2" fill="#e08a2a" opacity=".5"/><circle cx="${n(cx + 3)}" cy="${n(cy + 3)}" r="1.6" fill="#e08a2a" opacity=".45"/>`,
    );
  } else {
    parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${wood === 'golden-mist' ? 11 : 9}" fill="${palette.light}" opacity="${wood === 'golden-mist' ? 0.8 : 0.95}"/>`);
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

/** Leaves on their way down the length of the card; a golden mist among the far trees. */
function drift(rng: Rng, wood: BookmarkWood, palette: Palette, length: number): string {
  const parts: string[] = [];
  const top = Math.max(110, length * 0.3);
  const count = Math.max(8, Math.round(length / 34));
  for (let i = 0; i < count; i++) {
    const x = between(rng, 6, 54);
    const y = between(rng, top, length - 40);
    const size = between(rng, 1.3, 2.1);
    parts.push(`<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(size)}" ry="${n(size / 2)}" transform="rotate(${n(between(rng, 0, 180))} ${n(x)} ${n(y)})" fill="${pick(rng, palette.leaves)}"/>`);
  }
  if (wood === 'golden-mist') {
    const depth = woodsDepth(length);
    for (const at of [0.85, 0.62, 0.4]) {
      const y = length - depth * at;
      parts.push(`<rect x="-2" y="${n(y + between(rng, -4, 4))}" width="${CARD_W + 4}" height="${n(between(rng, 6, 10))}" fill="#fff3d6" opacity=".35"/>`);
    }
  }
  return parts.join('');
}

/** The forest floor: a carpet of fallen leaves at the foot of the card. */
function carpet(rng: Rng, palette: Palette, length: number): string {
  const parts = [`<rect x="-2" y="${n(length - 14)}" width="${CARD_W + 4}" height="20" fill="${palette.ground}"/>`];
  for (let i = 0; i < 26; i++) {
    const x = between(rng, -1, 61);
    const y = between(rng, length - 14, length - 2);
    const size = between(rng, 1.4, 2.4);
    parts.push(`<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(size)}" ry="${n(size * 0.55)}" transform="rotate(${n(between(rng, -40, 40))} ${n(x)} ${n(y)})" fill="${pick(rng, palette.leaves)}"/>`);
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
  const wood = BOOKMARK_WOODS[Math.floor(rng() * BOOKMARK_WOODS.length)] ?? 'dusk';
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
    rows.push(row(rng, base, (26 + 18 * t) * k, color, palette, (1 - t) * 0.45, L));
    if (i === count - 2) rows.push(drift(rng, wood, palette, L));
  }
  const painting = [
    sky(rng, wood, palette, id, L),
    L > CARD_H * 1.5 ? hills(rng, L - depth - 6, palette.far, L, 2.4 * k, 0.55) : '',
    hills(rng, L - depth + 12, palette.far, L),
    ...rows,
    carpet(rng, palette, L),
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
