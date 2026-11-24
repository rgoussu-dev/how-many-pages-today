/*
 * The card illustration: a small landscape painted from a seed. Pure string output, no
 * DOM, no network — the same seed always paints the same picture, so a day's card looks
 * the same every time it is opened, online or not.
 */

export type SceneKind = 'mountains' | 'night' | 'sea' | 'forest' | 'dunes' | 'library';

export interface Scene {
  readonly kind: SceneKind;
  /** A short description for assistive technology. */
  readonly label: string;
  readonly svg: string;
}

const W = 400;
const H = 300;
const KINDS: readonly SceneKind[] = ['mountains', 'night', 'sea', 'forest', 'dunes', 'library'];
const LABELS: Record<SceneKind, string> = {
  mountains: 'Mountains at dawn',
  night: 'Hills under a starry sky',
  sea: 'A sailboat on an evening sea',
  forest: 'A pine forest',
  dunes: 'Desert dunes in the sun',
  library: 'A shelf of books',
};

type Rng = () => number;

/** mulberry32 — tiny, fast, good enough for pictures. */
function seeded(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng: Rng, low: number, high: number): number => low + rng() * (high - low);
const r1 = (n: number): string => (Math.round(n * 10) / 10).toString();
const hsl = (h: number, s: number, l: number, a = 1): string =>
  a === 1 ? `hsl(${r1(((h % 360) + 360) % 360)} ${r1(s)}% ${r1(l)}%)` : `hsl(${r1(((h % 360) + 360) % 360)} ${r1(s)}% ${r1(l)}% / ${a})`;

function skyGradient(id: string, top: string, bottom: string): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;
}

/** A jagged ridge (sharp) or rolling one (smooth), closed down to the bottom edge. */
function ridge(rng: Rng, base: number, amplitude: number, segments: number, smooth: boolean): string {
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) points.push([(i * W) / segments, base + (rng() * 2 - 1) * amplitude]);
  const [first] = points;
  let d = `M0 ${H} L${r1(first![0])} ${r1(first![1])}`;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i]!;
    if (smooth) {
      const [px, py] = points[i - 1]!;
      d += ` Q${r1(px)} ${r1(py)} ${r1((px + x) / 2)} ${r1((py + y) / 2)}`;
      if (i === points.length - 1) d += ` T${r1(x)} ${r1(y)}`;
    } else {
      d += ` L${r1(x)} ${r1(y)}`;
    }
  }
  return `${d} L${W} ${H} Z`;
}

function stars(rng: Rng, count: number, maxY: number): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    out += `<circle cx="${r1(between(rng, 0, W))}" cy="${r1(between(rng, 0, maxY))}" r="${r1(between(rng, 0.5, 1.6))}" fill="#fff" opacity="${r1(between(rng, 0.4, 1))}"/>`;
  }
  return out;
}

function pine(x: number, baseY: number, height: number, fill: string): string {
  const w = height * 0.42;
  const tiers = [0, 0.3, 0.55]
    .map((t) => {
      const top = baseY - height + t * height;
      const bottom = top + height * 0.55;
      const half = (w / 2) * (0.6 + t);
      return `<path d="M${r1(x)} ${r1(top)} L${r1(x + half)} ${r1(bottom)} L${r1(x - half)} ${r1(bottom)} Z" fill="${fill}"/>`;
    })
    .join('');
  return `<rect x="${r1(x - height * 0.03)}" y="${r1(baseY - height * 0.1)}" width="${r1(height * 0.06)}" height="${r1(height * 0.12)}" fill="${fill}"/>${tiers}`;
}

function mountains(rng: Rng, id: string, hue: number): string {
  const sunX = between(rng, 80, 320);
  return [
    `<defs>${skyGradient(`${id}-sky`, hsl(hue + 200, 55, 72), hsl(hue + 20, 85, 84))}</defs>`,
    `<rect width="${W}" height="${H}" fill="url(#${id}-sky)"/>`,
    `<circle cx="${r1(sunX)}" cy="${r1(between(rng, 90, 130))}" r="${r1(between(rng, 26, 40))}" fill="${hsl(hue + 30, 95, 70)}"/>`,
    `<path d="${ridge(rng, 150, 45, 7, false)}" fill="${hsl(hue + 230, 25, 62)}"/>`,
    `<path d="${ridge(rng, 195, 35, 9, false)}" fill="${hsl(hue + 230, 28, 45)}"/>`,
    `<path d="${ridge(rng, 245, 18, 6, true)}" fill="${hsl(hue + 230, 32, 28)}"/>`,
  ].join('');
}

function night(rng: Rng, id: string, hue: number): string {
  const moonX = between(rng, 60, 340);
  const moonY = between(rng, 55, 95);
  const moonR = between(rng, 18, 26);
  return [
    `<defs>${skyGradient(`${id}-sky`, hsl(hue + 230, 55, 12), hsl(hue + 250, 45, 30))}</defs>`,
    `<rect width="${W}" height="${H}" fill="url(#${id}-sky)"/>`,
    stars(rng, 70, 190),
    `<circle cx="${r1(moonX)}" cy="${r1(moonY)}" r="${r1(moonR)}" fill="#fdf6dc"/>`,
    `<circle cx="${r1(moonX + moonR * 0.45)}" cy="${r1(moonY - moonR * 0.2)}" r="${r1(moonR * 0.9)}" fill="${hsl(hue + 232, 52, 15)}"/>`,
    `<path d="${ridge(rng, 215, 22, 5, true)}" fill="${hsl(hue + 240, 30, 18)}"/>`,
    `<path d="${ridge(rng, 255, 14, 4, true)}" fill="${hsl(hue + 240, 35, 10)}"/>`,
  ].join('');
}

function sea(rng: Rng, id: string, hue: number): string {
  const horizon = between(rng, 150, 175);
  const sunX = between(rng, 90, 310);
  const boatX = between(rng, 60, 340);
  const boatY = horizon + between(rng, 40, 70);
  const waves = Array.from({ length: 9 }, (_, i) => {
    const y = horizon + 14 + i * 14;
    const offset = between(rng, 0, 40);
    let d = `M${r1(-offset)} ${y}`;
    for (let x = -offset; x < W + 40; x += 40) d += ` q10 -4 20 0 t20 0`;
    return `<path d="${d}" stroke="#fff" stroke-opacity="${r1(0.15 + i * 0.02)}" stroke-width="1.5" fill="none"/>`;
  }).join('');
  return [
    `<defs>${skyGradient(`${id}-sky`, hsl(hue + 280, 45, 62), hsl(hue + 25, 90, 78))}${skyGradient(`${id}-sea`, hsl(hue + 210, 45, 42), hsl(hue + 215, 55, 22))}</defs>`,
    `<rect width="${W}" height="${H}" fill="url(#${id}-sky)"/>`,
    `<circle cx="${r1(sunX)}" cy="${r1(horizon)}" r="${r1(between(rng, 30, 44))}" fill="${hsl(hue + 25, 95, 66)}"/>`,
    `<rect y="${r1(horizon)}" width="${W}" height="${r1(H - horizon)}" fill="url(#${id}-sea)"/>`,
    `<rect x="${r1(sunX - 30)}" y="${r1(horizon + 4)}" width="60" height="5" rx="2.5" fill="${hsl(hue + 25, 95, 75)}" opacity=".6"/>`,
    `<rect x="${r1(sunX - 18)}" y="${r1(horizon + 14)}" width="36" height="4" rx="2" fill="${hsl(hue + 25, 95, 75)}" opacity=".4"/>`,
    waves,
    `<path d="M${r1(boatX - 26)} ${r1(boatY)} L${r1(boatX + 26)} ${r1(boatY)} L${r1(boatX + 18)} ${r1(boatY + 10)} L${r1(boatX - 18)} ${r1(boatY + 10)} Z" fill="${hsl(hue + 10, 30, 18)}"/>`,
    `<path d="M${r1(boatX)} ${r1(boatY - 48)} L${r1(boatX)} ${r1(boatY - 2)} L${r1(boatX + 24)} ${r1(boatY - 4)} Z" fill="#fbf7ef"/>`,
    `<path d="M${r1(boatX - 3)} ${r1(boatY - 40)} L${r1(boatX - 3)} ${r1(boatY - 4)} L${r1(boatX - 20)} ${r1(boatY - 4)} Z" fill="#efe6d6"/>`,
  ].join('');
}

function forest(rng: Rng, id: string, hue: number): string {
  const rows = [
    { base: 200, size: [60, 90], light: 55, count: 11 },
    { base: 245, size: [80, 120], light: 36, count: 9 },
    { base: 300, size: [110, 160], light: 20, count: 7 },
  ];
  const trees = rows
    .map((row) =>
      Array.from({ length: row.count }, () =>
        pine(between(rng, -10, W + 10), row.base, between(rng, row.size[0]!, row.size[1]!), hsl(hue + 140, 30, row.light)),
      ).join(''),
    )
    .join('');
  return [
    `<defs>${skyGradient(`${id}-sky`, hsl(hue + 190, 45, 80), hsl(hue + 60, 55, 88))}</defs>`,
    `<rect width="${W}" height="${H}" fill="url(#${id}-sky)"/>`,
    `<circle cx="${r1(between(rng, 60, 340))}" cy="${r1(between(rng, 55, 90))}" r="${r1(between(rng, 20, 30))}" fill="${hsl(hue + 50, 90, 92)}"/>`,
    `<path d="${ridge(rng, 170, 25, 5, true)}" fill="${hsl(hue + 160, 20, 70)}"/>`,
    trees,
  ].join('');
}

function dunes(rng: Rng, id: string, drift: number): string {
  const hue = drift * 0.3; // sand turns lime quickly: keep it close to its natural palette
  return [
    `<defs>${skyGradient(`${id}-sky`, hsl(hue + 195, 70, 70), hsl(hue + 40, 85, 86))}</defs>`,
    `<rect width="${W}" height="${H}" fill="url(#${id}-sky)"/>`,
    `<circle cx="${r1(between(rng, 70, 330))}" cy="${r1(between(rng, 60, 100))}" r="${r1(between(rng, 24, 34))}" fill="${hsl(hue + 45, 100, 88)}"/>`,
    `<path d="${ridge(rng, 185, 25, 4, true)}" fill="${hsl(hue + 30, 60, 72)}"/>`,
    `<path d="${ridge(rng, 225, 25, 3, true)}" fill="${hsl(hue + 25, 62, 60)}"/>`,
    `<path d="${ridge(rng, 265, 18, 3, true)}" fill="${hsl(hue + 20, 58, 46)}"/>`,
  ].join('');
}

function library(rng: Rng, id: string, hue: number): string {
  const shelves = [110, 205, 300];
  const spines = shelves
    .map((floor) => {
      let x = between(rng, 6, 20);
      let out = '';
      while (x < W - 14) {
        const w = between(rng, 11, 24);
        const h = between(rng, 52, 82);
        const fill = hsl(hue + between(rng, -60, 60) + (rng() < 0.3 ? 180 : 0), between(rng, 35, 60), between(rng, 32, 58));
        const lean = rng() < 0.08 ? ` transform="rotate(${r1(between(rng, -12, -6))} ${r1(x + w)} ${floor - 8})"` : '';
        out += `<g${lean}><rect x="${r1(x)}" y="${r1(floor - 8 - h)}" width="${r1(w)}" height="${r1(h)}" rx="1.5" fill="${fill}"/><rect x="${r1(x + 2)}" y="${r1(floor - h + 4)}" width="${r1(w - 4)}" height="3" fill="#fff" opacity=".35"/></g>`;
        x += w + between(rng, 0.5, 2.5);
        if (rng() < 0.07) x += between(rng, 14, 30);
      }
      return `${out}<rect x="0" y="${floor - 8}" width="${W}" height="10" fill="${hsl(hue + 25, 35, 26)}"/>`;
    })
    .join('');
  return [
    `<defs>${skyGradient(`${id}-wall`, hsl(hue + 30, 35, 32), hsl(hue + 30, 40, 22))}</defs>`,
    `<rect width="${W}" height="${H}" fill="url(#${id}-wall)"/>`,
    spines,
  ].join('');
}

const PAINTERS: Record<SceneKind, (rng: Rng, id: string, hue: number) => string> = {
  mountains,
  night,
  sea,
  forest,
  dunes,
  library,
};

export function renderScene(seed: number): Scene {
  const rng = seeded(seed);
  const kind = KINDS[Math.floor(rng() * KINDS.length)] ?? 'mountains';
  // Keep hues gentle: a ±40° drift around each scene's natural palette.
  const hue = between(rng, -40, 40);
  const id = `scene-${seed >>> 0}`;
  const body = PAINTERS[kind](rng, id, hue);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${body}</svg>`;
  return { kind, label: LABELS[kind], svg };
}
