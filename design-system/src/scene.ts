/*
 * The card illustration: a cosy library vignette painted from a seed. Pure string output,
 * no DOM, no network — the same seed always paints the same picture, so a day's card
 * looks the same every time it is opened, online or not.
 */

export type SceneKind = 'shelves' | 'lamp' | 'nook' | 'armchair' | 'window' | 'still-life';

export interface Scene {
  readonly kind: SceneKind;
  /** A short description for assistive technology. */
  readonly label: string;
  readonly svg: string;
}

const W = 400;
const H = 300;
const KINDS: readonly SceneKind[] = ['shelves', 'lamp', 'nook', 'armchair', 'window', 'still-life'];
const LABELS: Record<SceneKind, string> = {
  shelves: 'Dusty bookshelves in a beam of afternoon light',
  lamp: "A green banker's lamp over an open book and a cup of tea",
  nook: 'A window seat piled with pillows and a knitted blanket, autumn outside',
  armchair: 'A leather armchair with a blanket, beside a glowing lamp',
  window: 'Books and a candle on a windowsill, an autumn evening outside',
  'still-life': 'A stack of old leather books with a candle',
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
const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)] as T;
const n = (value: number): string => (Math.round(value * 10) / 10).toString();
const hsl = (h: number, s: number, l: number, a = 1): string => {
  const hue = n(((h % 360) + 360) % 360);
  return a === 1 ? `hsl(${hue} ${n(s)}% ${n(l)}%)` : `hsl(${hue} ${n(s)}% ${n(l)}% / ${a})`;
};

/** Old leather bindings: oxblood, forest, navy, ochre, chestnut, plum, teal. */
const LEATHERS: readonly [number, number, number][] = [
  [6, 55, 28],
  [140, 30, 22],
  [218, 35, 24],
  [36, 58, 38],
  [24, 45, 24],
  [330, 25, 24],
  [182, 30, 23],
  [14, 45, 34],
];
const GILT = '#d8b46a';
const GILT_DARK = '#9c7a35';
const CREAM = '#f1e4c6';

const leather = (rng: Rng, shift = 0): string => {
  const [h, s, l] = pick(rng, LEATHERS);
  return hsl(h + between(rng, -6, 6), s + between(rng, -6, 6), l + shift + between(rng, -4, 4));
};

// — shared defs ——————————————————————————————————————————————————————————————

function defs(id: string): string {
  return [
    // spine shading: a rounded spine catches the light on its left edge
    `<linearGradient id="${id}-shade" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>`,
    `<linearGradient id="${id}-shade-v" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>`,
    `<radialGradient id="${id}-glow"><stop offset="0" stop-color="#ffd58a" stop-opacity=".9"/><stop offset=".35" stop-color="#ffb44d" stop-opacity=".35"/><stop offset="1" stop-color="#ff9a2e" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="${id}-vignette" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#1c0f05" stop-opacity="0"/><stop offset="1" stop-color="#1c0f05" stop-opacity=".55"/></radialGradient>`,
    `<filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .2  0 0 0 0 .1  0 0 0 .55 0"/></filter>`,
  ].join('');
}

/** The finish every plate gets: warm cast, paper grain, darkened edges. */
const finish = (id: string): string =>
  `<rect width="${W}" height="${H}" fill="#c98a35" opacity=".07"/>` +
  `<rect width="${W}" height="${H}" filter="url(#${id}-grain)" opacity=".35"/>` +
  `<rect width="${W}" height="${H}" fill="url(#${id}-vignette)"/>`;

const glow = (id: string, cx: number, cy: number, r: number, opacity = 1): string =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="url(#${id}-glow)" opacity="${opacity}"/>`;

const backdrop = (top: string, bottom: string, key: string): string =>
  `<linearGradient id="${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient><rect width="${W}" height="${H}" fill="url(#${key})"/>`;

// — props —————————————————————————————————————————————————————————————————————

/** A book standing upright, spine out. (x, floor) is its bottom-left corner. */
function spine(rng: Rng, id: string, x: number, floor: number, w: number, h: number, lean = 0): string {
  const top = floor - h;
  const color = leather(rng);
  const bands = [top + h * 0.1, top + h * 0.17, floor - h * 0.14]
    .map((y) => `<rect x="${n(x + 1)}" y="${n(y)}" width="${n(w - 2)}" height="1.6" fill="${GILT}" opacity=".85"/>`)
    .join('');
  const label =
    rng() < 0.6
      ? `<rect x="${n(x + 2.5)}" y="${n(top + h * 0.3)}" width="${n(w - 5)}" height="${n(h * between(rng, 0.14, 0.22))}" fill="${hsl(20, 30, 12, 0.55)}" stroke="${GILT_DARK}" stroke-width=".6"/>`
      : '';
  const tilt = lean ? ` transform="rotate(${n(lean)} ${n(lean < 0 ? x : x + w)} ${n(floor)})"` : '';
  return `<g${tilt}><rect x="${n(x)}" y="${n(top)}" width="${n(w)}" height="${n(h)}" rx="1.4" fill="${color}"/>${label}${bands}<rect x="${n(x)}" y="${n(top)}" width="${n(w)}" height="${n(h)}" rx="1.4" fill="url(#${id}-shade)"/></g>`;
}

/** A book lying flat, spine toward us, with its page edges showing at the far end. */
function flatBook(rng: Rng, id: string, x: number, bottom: number, w: number, h: number, color = leather(rng)): string {
  const y = bottom - h;
  return (
    `<rect x="${n(x + w - 5)}" y="${n(y + 2)}" width="6" height="${n(h - 4)}" fill="${CREAM}"/>` +
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w - 3)}" height="${n(h)}" rx="2" fill="${color}"/>` +
    `<rect x="${n(x + w * 0.12)}" y="${n(y + 1.5)}" width="1.4" height="${n(h - 3)}" fill="${GILT}" opacity=".8"/>` +
    `<rect x="${n(x + w * 0.82)}" y="${n(y + 1.5)}" width="1.4" height="${n(h - 3)}" fill="${GILT}" opacity=".8"/>` +
    (rng() < 0.7
      ? `<rect x="${n(x + w * 0.36)}" y="${n(y + h * 0.25)}" width="${n(w * 0.28)}" height="${n(h * 0.5)}" fill="none" stroke="${GILT}" stroke-width=".8" opacity=".85"/>`
      : '') +
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w - 3)}" height="${n(h)}" rx="2" fill="url(#${id}-shade-v)"/>`
  );
}

function candle(rng: Rng, id: string, cx: number, base: number, height: number): string {
  const w = height * 0.32;
  const top = base - height;
  const drips = Array.from({ length: 3 }, () => {
    const dx = between(rng, -w / 2 + 2, w / 2 - 2);
    const len = between(rng, 4, height * 0.35);
    return `<rect x="${n(cx + dx - 1.4)}" y="${n(top)}" width="2.8" height="${n(len)}" rx="1.4" fill="#fbf2dc"/>`;
  }).join('');
  return (
    glow(id, cx, top - 10, height * 2.2) +
    `<ellipse cx="${n(cx)}" cy="${n(base)}" rx="${n(w * 1.3)}" ry="${n(w * 0.35)}" fill="#b08435"/>` +
    `<rect x="${n(cx - w / 2)}" y="${n(top)}" width="${n(w)}" height="${n(height)}" fill="#efe0bd"/>` +
    drips +
    `<rect x="${n(cx - w / 2)}" y="${n(top)}" width="${n(w)}" height="${n(height)}" fill="url(#${id}-shade)"/>` +
    `<line x1="${n(cx)}" y1="${n(top)}" x2="${n(cx)}" y2="${n(top - 5)}" stroke="#2a1a0c" stroke-width="1.2"/>` +
    `<path d="M${n(cx)} ${n(top - 22)} C${n(cx + 6)} ${n(top - 12)} ${n(cx + 5)} ${n(top - 4)} ${n(cx)} ${n(top - 3)} C${n(cx - 5)} ${n(top - 4)} ${n(cx - 6)} ${n(top - 12)} ${n(cx)} ${n(top - 22)} Z" fill="#ffcf6b"/>` +
    `<path d="M${n(cx)} ${n(top - 15)} C${n(cx + 3)} ${n(top - 9)} ${n(cx + 2)} ${n(top - 5)} ${n(cx)} ${n(top - 4)} C${n(cx - 2)} ${n(top - 5)} ${n(cx - 3)} ${n(top - 9)} ${n(cx)} ${n(top - 15)} Z" fill="#fff6d8"/>`
  );
}

function mug(rng: Rng, x: number, base: number, size: number): string {
  const color = pick(rng, ['#e9dcc0', '#7a3b28', '#3f5a48', '#c8a25a']);
  const steam = [0, 1]
    .map((i) => {
      const sx = x + size * (0.3 + i * 0.35);
      return `<path d="M${n(sx)} ${n(base - size - 4)} c-5 -8 5 -12 0 -20 s5 -12 0 -18" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>`;
    })
    .join('');
  return (
    steam +
    `<path d="M${n(x + size)} ${n(base - size * 0.75)} a${n(size * 0.28)} ${n(size * 0.28)} 0 1 1 0 ${n(size * 0.5)}" fill="none" stroke="${color}" stroke-width="${n(size * 0.12)}"/>` +
    `<path d="M${n(x)} ${n(base - size)} h${n(size)} v${n(size * 0.75)} a${n(size * 0.25)} ${n(size * 0.25)} 0 0 1 -${n(size * 0.25)} ${n(size * 0.25)} h-${n(size * 0.5)} a${n(size * 0.25)} ${n(size * 0.25)} 0 0 1 -${n(size * 0.25)} -${n(size * 0.25)} Z" fill="${color}"/>` +
    `<ellipse cx="${n(x + size / 2)}" cy="${n(base - size)}" rx="${n(size / 2)}" ry="${n(size * 0.12)}" fill="#3b2314"/>`
  );
}

function openBook(x: number, y: number, w: number): string {
  const h = w * 0.42;
  const mid = x + w / 2;
  const lines = Array.from({ length: 5 }, (_, i) => {
    const ly = y + h * (0.28 + i * 0.12);
    return (
      `<path d="M${n(x + w * 0.09)} ${n(ly)} Q${n(x + w * 0.25)} ${n(ly - 3)} ${n(mid - w * 0.06)} ${n(ly)}" stroke="#8a7458" stroke-width=".9" fill="none" opacity=".55"/>` +
      `<path d="M${n(mid + w * 0.06)} ${n(ly)} Q${n(x + w * 0.75)} ${n(ly - 3)} ${n(x + w * 0.91)} ${n(ly)}" stroke="#8a7458" stroke-width=".9" fill="none" opacity=".55"/>`
    );
  }).join('');
  return (
    `<ellipse cx="${n(mid)}" cy="${n(y + h + 3)}" rx="${n(w * 0.52)}" ry="6" fill="#000" opacity=".25"/>` +
    `<path d="M${n(x - 3)} ${n(y + h + 2)} L${n(x)} ${n(y + 4)} Q${n(x + w * 0.25)} ${n(y - 6)} ${n(mid)} ${n(y + 6)} Q${n(x + w * 0.75)} ${n(y - 6)} ${n(x + w)} ${n(y + 4)} L${n(x + w + 3)} ${n(y + h + 2)} Z" fill="#5b2617"/>` +
    `<path d="M${n(x)} ${n(y + h)} L${n(x + 2)} ${n(y + 2)} Q${n(x + w * 0.25)} ${n(y - 8)} ${n(mid)} ${n(y + 4)} L${n(mid)} ${n(y + h + 4)} Q${n(x + w * 0.25)} ${n(y + h - 6)} ${n(x)} ${n(y + h)} Z" fill="${CREAM}"/>` +
    `<path d="M${n(x + w)} ${n(y + h)} L${n(x + w - 2)} ${n(y + 2)} Q${n(x + w * 0.75)} ${n(y - 8)} ${n(mid)} ${n(y + 4)} L${n(mid)} ${n(y + h + 4)} Q${n(x + w * 0.75)} ${n(y + h - 6)} ${n(x + w)} ${n(y + h)} Z" fill="#e8d8b4"/>` +
    lines
  );
}

function pillow(rng: Rng, cx: number, cy: number, w: number, h: number, tilt: number): string {
  const base = pick(rng, ['#c8862f', '#8c3a22', '#e8dcc0', '#6f7f56', '#a3593a', '#d6b15a', '#7a4a5a']);
  const pattern = rng();
  const deco =
    pattern < 0.35
      ? Array.from({ length: 4 }, (_, i) => `<rect x="${n(-w / 2)}" y="${n(-h / 2 + (i + 0.6) * (h / 4.4))}" width="${n(w)}" height="${n(h / 14)}" fill="#fff" opacity=".22"/>`).join('')
      : pattern < 0.6
        ? `<circle r="${n(h * 0.18)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`
        : '';
  return (
    `<g transform="translate(${n(cx)} ${n(cy)}) rotate(${n(tilt)})">` +
    `<rect x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" rx="${n(h * 0.38)}" fill="${base}"/>${deco}` +
    `<rect x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" rx="${n(h * 0.38)}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="2"/>` +
    `<ellipse cx="0" cy="${n(h * 0.18)}" rx="${n(w * 0.42)}" ry="${n(h * 0.3)}" fill="#000" opacity=".12"/>` +
    `</g>`
  );
}

/** A knitted throw: a draped shape with cable stitches. */
function blanket(rng: Rng, x: number, y: number, w: number, h: number): string {
  const color = pick(rng, ['#b9663a', '#e6d6b4', '#8e3b2b', '#c99a3e', '#5f6f4d']);
  let wave = `M${n(x)} ${n(y)} L${n(x + w)} ${n(y)} L${n(x + w)} ${n(y + h)}`;
  for (let i = 6; i >= 0; i--) wave += ` Q${n(x + (w * (i + 0.5)) / 7)} ${n(y + h + 10)} ${n(x + (w * i) / 7)} ${n(y + h)}`;
  const cables = Array.from({ length: Math.floor(w / 18) }, (_, i) => {
    const cx = x + 9 + i * 18;
    let d = '';
    for (let yy = y + 6; yy < y + h - 4; yy += 9) d += `M${n(cx - 4)} ${n(yy)} L${n(cx)} ${n(yy + 5)} L${n(cx + 4)} ${n(yy)} `;
    return `<path d="${d}" stroke="#000" stroke-opacity=".18" stroke-width="1.4" fill="none"/>`;
  }).join('');
  return `<path d="${wave} Z" fill="${color}"/>${cables}<path d="${wave} Z" fill="none" stroke="#000" stroke-opacity=".15" stroke-width="1.5"/>`;
}

function autumnTrees(rng: Rng, left: number, right: number, ground: number, count: number): string {
  return Array.from({ length: count }, () => {
    const cx = between(rng, left, right);
    const r = between(rng, 16, 30);
    const color = pick(rng, ['#c8602a', '#d98c2b', '#a8452a', '#b9862c', '#8b3a1f', '#d2a04a']);
    const trunk = `<rect x="${n(cx - 2)}" y="${n(ground - r * 1.2)}" width="4" height="${n(r * 1.2)}" fill="#4a2e1c"/>`;
    const crown = [0, 1, 2]
      .map(() => `<circle cx="${n(cx + between(rng, -r * 0.5, r * 0.5))}" cy="${n(ground - r * 1.3 + between(rng, -r * 0.4, r * 0.3))}" r="${n(r * between(rng, 0.6, 0.85))}" fill="${color}"/>`)
      .join('');
    return trunk + crown;
  }).join('');
}

function fallingLeaves(rng: Rng, left: number, top: number, right: number, bottom: number, count: number): string {
  return Array.from({ length: count }, () => {
    const x = between(rng, left, right);
    const y = between(rng, top, bottom);
    return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="3.2" ry="1.6" fill="${pick(rng, ['#d9822b', '#b94a24', '#e0b04a'])}" transform="rotate(${n(between(rng, 0, 180))} ${n(x)} ${n(y)})"/>`;
  }).join('');
}

function windowFrame(x: number, y: number, w: number, h: number, cols: number, rows: number, wood: string): string {
  const bars = [
    ...Array.from({ length: cols - 1 }, (_, i) => `<rect x="${n(x + ((i + 1) * w) / cols - 2)}" y="${n(y)}" width="4" height="${n(h)}" fill="${wood}"/>`),
    ...Array.from({ length: rows - 1 }, (_, i) => `<rect x="${n(x)}" y="${n(y + ((i + 1) * h) / rows - 2)}" width="${n(w)}" height="4" fill="${wood}"/>`),
  ].join('');
  return `${bars}<rect x="${n(x - 6)}" y="${n(y - 6)}" width="${n(w + 12)}" height="${n(h + 12)}" fill="none" stroke="${wood}" stroke-width="12"/>`;
}

// — the scenes ——————————————————————————————————————————————————————————————————

function shelves(rng: Rng, id: string): string {
  const floors = [100, 200, 300];
  const out: string[] = [backdrop('#3a2416', '#1f130b', `${id}-back`)];
  for (const floor of floors) {
    let x = 14;
    const room = between(rng, 0, 1);
    while (x < W - 30) {
      if (rng() < 0.06 && room > 0.3) {
        // a little stack lying flat, or an hourglass, keeps the rhythm irregular
        if (rng() < 0.5) {
          const w = between(rng, 40, 56);
          out.push(flatBook(rng, id, x, floor - 10, w, 9), flatBook(rng, id, x + 3, floor - 19, w - 6, 9));
          x += w + 4;
        } else {
          out.push(
            `<rect x="${n(x)}" y="${n(floor - 46)}" width="24" height="4" fill="#8a6a35"/><rect x="${n(x)}" y="${n(floor - 14)}" width="24" height="4" fill="#8a6a35"/>` +
              `<path d="M${n(x + 3)} ${n(floor - 42)} L${n(x + 21)} ${n(floor - 42)} L${n(x + 13)} ${n(floor - 28)} L${n(x + 21)} ${n(floor - 14)} L${n(x + 3)} ${n(floor - 14)} L${n(x + 11)} ${n(floor - 28)} Z" fill="#f3e6c8" opacity=".55"/>` +
              `<path d="M${n(x + 7)} ${n(floor - 14)} L${n(x + 17)} ${n(floor - 14)} L${n(x + 12)} ${n(floor - 22)} Z" fill="#d8b46a"/>`,
          );
          x += 32;
        }
        continue;
      }
      const w = between(rng, 11, 22);
      const h = between(rng, 56, 84);
      out.push(spine(rng, id, x, floor - 10, w, h, rng() < 0.07 ? between(rng, -14, -7) : 0));
      x += w + between(rng, 0.4, 1.6);
      if (rng() < 0.05) x += between(rng, 10, 24);
    }
    out.push(
      `<rect x="0" y="${floor - 10}" width="${W}" height="11" fill="#5a3a22"/><rect x="0" y="${floor - 10}" width="${W}" height="2" fill="#8a6440" opacity=".7"/>`,
      // dust along the shelf's front edge
      `<rect x="0" y="${floor - 10}" width="${W}" height="1" fill="#e9dcc4" opacity=".25"/>`,
    );
  }
  // the afternoon sunbeam, and the dust it reveals
  const beamX = between(rng, 220, 360);
  out.push(
    `<linearGradient id="${id}-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2a8" stop-opacity=".42"/><stop offset="1" stop-color="#ffe2a8" stop-opacity="0"/></linearGradient>`,
    `<path d="M${n(beamX)} 0 L${n(beamX + 90)} 0 L${n(beamX - 70)} ${H} L${n(beamX - 190)} ${H} Z" fill="url(#${id}-beam)"/>`,
  );
  for (let i = 0; i < 46; i++) {
    const t = rng();
    const across = rng();
    const x = beamX + 90 * across - t * 160 - 70 * t * 0;
    out.push(`<circle cx="${n(x - across * 30)}" cy="${n(t * H)}" r="${n(between(rng, 0.5, 1.6))}" fill="#fff1cf" opacity="${n(between(rng, 0.25, 0.8))}"/>`);
  }
  // a cobweb in the top corner — nobody has dusted up there in years
  if (rng() < 0.6) {
    const c = rng() < 0.5 ? 0 : W;
    const s = c === 0 ? 1 : -1;
    out.push(
      `<g stroke="#f3ead8" stroke-opacity=".35" stroke-width=".7" fill="none">` +
        [0.15, 0.45, 0.8].map((a) => `<line x1="${c}" y1="0" x2="${n(c + s * 46 * Math.cos(a))}" y2="${n(46 * Math.sin(a))}"/>`).join('') +
        [16, 28, 40].map((r) => `<path d="M${n(c + s * r)} 0 Q${n(c + s * r * 0.75)} ${n(r * 0.5)} ${n(c + s * r * 0.7)} ${n(r * 0.75)}"/>`).join('') +
        `</g>`,
    );
  }
  return out.join('');
}

function lamp(rng: Rng, id: string): string {
  const lampX = between(rng, 120, 280);
  const desk = 222;
  const shadeY = 112;
  const green = hsl(between(rng, 140, 160), 50, 28);
  const bookLeft = lampX < 200;
  const bookX = bookLeft ? between(rng, 22, 44) : between(rng, 250, 270);
  return [
    backdrop('#24261b', '#14120b', `${id}-wall`),
    // wainscot panels
    `<rect y="150" width="${W}" height="${desk - 150}" fill="#2b1d12" opacity=".7"/>`,
    ...[0, 1, 2, 3].map((i) => `<rect x="${12 + i * 98}" y="160" width="84" height="${desk - 172}" rx="3" fill="none" stroke="#5a3d24" stroke-opacity=".6" stroke-width="2"/>`),
    glow(id, lampX, shadeY + 40, 230, 0.75),
    // the desk
    backdrop('#5c3920', '#3a2414', `${id}-desk`).replace(`<rect width="${W}" height="${H}"`, `<rect y="${desk}" width="${W}" height="${H - desk}"`),
    `<rect y="${desk}" width="${W}" height="3" fill="#8a5d36"/>`,
    // the pool of light on the desk
    `<ellipse cx="${n(lampX)}" cy="${desk + 18}" rx="120" ry="22" fill="#ffd27a" opacity=".22"/>`,
    openBook(bookX, desk - 6, 118),
    mug(rng, bookLeft ? between(rng, 330, 350) : between(rng, 30, 60), desk + 34, 30),
    // banker's lamp: brass base and stem, green glass shade
    `<ellipse cx="${n(lampX)}" cy="${desk + 12}" rx="38" ry="9" fill="#8a6427"/><ellipse cx="${n(lampX)}" cy="${desk + 9}" rx="34" ry="7" fill="#c39a45"/>`,
    `<rect x="${n(lampX - 3)}" y="${shadeY + 20}" width="6" height="${desk - shadeY - 12}" fill="#b78d3c"/>`,
    `<rect x="${n(lampX - 3)}" y="${shadeY + 20}" width="2" height="${desk - shadeY - 12}" fill="#f0d28a" opacity=".6"/>`,
    `<path d="M${n(lampX - 70)} ${shadeY + 26} Q${n(lampX - 64)} ${shadeY - 8} ${n(lampX)} ${shadeY - 10} Q${n(lampX + 64)} ${shadeY - 8} ${n(lampX + 70)} ${shadeY + 26} Z" fill="${green}"/>`,
    `<path d="M${n(lampX - 56)} ${shadeY + 6} Q${n(lampX - 30)} ${shadeY - 8} ${n(lampX + 10)} ${shadeY - 7}" stroke="#fff" stroke-opacity=".3" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    `<rect x="${n(lampX - 72)}" y="${shadeY + 24}" width="144" height="5" rx="2.5" fill="#c39a45"/>`,
    `<path d="M${n(lampX - 64)} ${shadeY + 29} L${n(lampX + 64)} ${shadeY + 29} L${n(lampX + 150)} ${desk + 6} L${n(lampX - 150)} ${desk + 6} Z" fill="#ffe29a" opacity=".08"/>`,
    `<line x1="${n(lampX + 30)}" y1="${shadeY + 29}" x2="${n(lampX + 30)}" y2="${shadeY + 58}" stroke="#c39a45" stroke-width="1.2"/><circle cx="${n(lampX + 30)}" cy="${shadeY + 60}" r="2.4" fill="#c39a45"/>`,
  ].join('');
}

function nook(rng: Rng, id: string): string {
  const seat = 196;
  const wx = 64;
  const ww = 272;
  const wy = 26;
  const wh = 150;
  const wood = '#6b4529';
  const pillows: string[] = [];
  const count = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const w = between(rng, 56, 84);
    const h = between(rng, 40, 54);
    const back = i < count / 2;
    pillows.push(pillow(rng, 20 + ((W - 40) * (i + 0.5)) / count + between(rng, -10, 10), seat - h / 2 + (back ? -8 : 6), w, h, between(rng, -16, 16)));
  }
  return [
    backdrop('#d9b98a', '#b38d5c', `${id}-wall`),
    `<clipPath id="${id}-pane"><rect x="${wx}" y="${wy}" width="${ww}" height="${wh}"/></clipPath>`,
    `<g clip-path="url(#${id}-pane)">`,
    backdrop('#f6d7a0', '#e5a868', `${id}-sky`),
    `<path d="M${wx} 140 Q160 110 260 128 T${wx + ww} 120 L${wx + ww} ${wy + wh} L${wx} ${wy + wh} Z" fill="#b9864f" opacity=".55"/>`,
    autumnTrees(rng, wx, wx + ww, wy + wh + 4, 7),
    fallingLeaves(rng, wx, wy, wx + ww, wy + wh, 14),
    `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="#fff" opacity=".08"/>`,
    `</g>`,
    windowFrame(wx, wy, ww, wh, 3, 2, wood),
    // sunlight falling through the panes onto the cushions
    `<path d="M${wx} ${wy + wh} L${wx + ww} ${wy + wh} L${wx + ww + 40} ${seat + 10} L${wx - 60} ${seat + 10} Z" fill="#ffe1a0" opacity=".25"/>`,
    // the seat: cushion and panelled base
    `<rect y="${seat}" width="${W}" height="${H - seat}" fill="#5a3a22"/>`,
    `<rect y="${seat - 4}" width="${W}" height="20" rx="8" fill="${pick(rng, ['#7a3328', '#4f5e3e', '#8a6232'])}"/>`,
    ...pillows,
    blanket(rng, between(rng, 10, 140), seat + 6, between(rng, 180, 240), 58),
    ...[0, 1, 2, 3].map((i) => `<rect x="${8 + i * 98}" y="${seat + 74}" width="86" height="40" rx="2" fill="none" stroke="#3a2414" stroke-opacity=".6" stroke-width="2"/>`),
    flatBook(rng, id, between(rng, 250, 300), seat + 6, 70, 12),
  ].join('');
}

function armchair(rng: Rng, id: string): string {
  const floor = 238;
  const chairX = between(rng, 150, 250);
  const tableLeft = chairX > 200;
  const tableX = tableLeft ? chairX - 150 : chairX + 110;
  const lampY = 96;
  const [lh, ls, ll] = pick(rng, LEATHERS);
  const color = hsl(lh, ls, ll + 6);
  const darker = hsl(lh, ls, ll - 2);
  const stripes = Array.from({ length: 14 }, (_, i) => `<rect x="${i * 30}" y="0" width="12" height="${floor}" fill="#000" opacity=".06"/>`).join('');
  const tufts = Array.from({ length: 9 }, (_, i) => `<circle cx="${n(chairX - 36 + (i % 3) * 36)}" cy="${n(112 + Math.floor(i / 3) * 24)}" r="2.2" fill="#000" opacity=".35"/>`).join('');
  return [
    backdrop('#4a2a1c', '#2c180f', `${id}-wall`),
    stripes,
    glow(id, tableX + 30, lampY + 20, 200, 0.85),
    `<rect y="${floor}" width="${W}" height="${H - floor}" fill="#4b2f1c"/>`,
    ...[0, 1, 2, 3, 4, 5].map((i) => `<line x1="0" y1="${floor + 10 + i * 11}" x2="${W}" y2="${floor + 10 + i * 11}" stroke="#2c1a0f" stroke-opacity=".5"/>`),
    `<ellipse cx="${n(chairX)}" cy="${floor + 34}" rx="150" ry="22" fill="${pick(rng, ['#7a2e22', '#3d4f3a', '#6b4a2a'])}"/>`,
    `<ellipse cx="${n(chairX)}" cy="${floor + 34}" rx="136" ry="16" fill="none" stroke="#d8b46a" stroke-opacity=".5" stroke-width="2"/>`,
    // side table with a fabric-shaded lamp
    `<rect x="${n(tableX)}" y="${floor - 70}" width="60" height="7" rx="2" fill="#6b4529"/>`,
    `<rect x="${n(tableX + 6)}" y="${floor - 63}" width="5" height="63" fill="#4a2e1c"/><rect x="${n(tableX + 49)}" y="${floor - 63}" width="5" height="63" fill="#4a2e1c"/>`,
    `<rect x="${n(tableX + 27)}" y="${lampY + 30}" width="6" height="${floor - 70 - lampY - 30}" fill="#c39a45"/>`,
    `<path d="M${n(tableX + 8)} ${lampY + 32} L${n(tableX + 18)} ${lampY - 8} L${n(tableX + 42)} ${lampY - 8} L${n(tableX + 52)} ${lampY + 32} Z" fill="#f6dca0"/>`,
    `<path d="M${n(tableX + 8)} ${lampY + 32} L${n(tableX + 52)} ${lampY + 32}" stroke="#d8a64a" stroke-width="3"/>`,
    mug(rng, tableX + 6, floor - 70, 16),
    // the wingback armchair
    `<path d="M${n(chairX - 64)} ${floor - 40} L${n(chairX - 66)} 102 Q${n(chairX - 64)} 74 ${n(chairX)} 72 Q${n(chairX + 64)} 74 ${n(chairX + 66)} 102 L${n(chairX + 64)} ${floor - 40} Z" fill="${color}"/>`,
    tufts,
    `<path d="M${n(chairX - 64)} ${floor - 40} L${n(chairX - 66)} 102 Q${n(chairX - 64)} 74 ${n(chairX)} 72 Q${n(chairX + 64)} 74 ${n(chairX + 66)} 102 L${n(chairX + 64)} ${floor - 40} Z" fill="url(#${id}-shade)" opacity=".6"/>`,
    // rolled arms in the same hide, a shade darker, in front of the back
    `<rect x="${n(chairX - 96)}" y="${floor - 104}" width="40" height="70" rx="16" fill="${darker}"/>`,
    `<rect x="${n(chairX + 56)}" y="${floor - 104}" width="40" height="70" rx="16" fill="${darker}"/>`,
    `<rect x="${n(chairX - 96)}" y="${floor - 104}" width="40" height="70" rx="16" fill="url(#${id}-shade)"/>`,
    `<rect x="${n(chairX + 56)}" y="${floor - 104}" width="40" height="70" rx="16" fill="url(#${id}-shade)"/>`,
    `<rect x="${n(chairX - 60)}" y="${floor - 66}" width="120" height="30" rx="10" fill="${color}"/>`,
    `<rect x="${n(chairX - 60)}" y="${floor - 66}" width="120" height="30" rx="10" fill="url(#${id}-shade-v)"/>`,
    ...[-84, -60, 60, 84].map((dx) => `<rect x="${n(chairX + dx - 3)}" y="${floor - 28}" width="6" height="28" fill="#2a1a0e"/>`),
    pillow(rng, chairX, floor - 80, 64, 42, between(rng, -10, 10)),
    // a blanket thrown over one arm
    `<g transform="rotate(${tableLeft ? 8 : -8} ${n(chairX)} ${floor - 90})">${blanket(rng, tableLeft ? chairX + 52 : chairX - 104, floor - 100, 52, 64)}</g>`,
    // books waiting on the floor
    flatBook(rng, id, tableLeft ? chairX + 96 : chairX - 168, floor + 30, 66, 12),
    flatBook(rng, id, tableLeft ? chairX + 100 : chairX - 164, floor + 18, 58, 12),
    flatBook(rng, id, tableLeft ? chairX + 98 : chairX - 166, floor + 6, 62, 12),
  ].join('');
}

function windowsill(rng: Rng, id: string): string {
  const sill = 206;
  const wx = 40;
  const ww = 320;
  const wy = 22;
  const wh = 178;
  const rain = Array.from({ length: 60 }, () => {
    const x = between(rng, wx, wx + ww);
    const y = between(rng, wy, wy + wh);
    return `<line x1="${n(x)}" y1="${n(y)}" x2="${n(x - 3)}" y2="${n(y + between(rng, 8, 16))}" stroke="#dfe8f0" stroke-opacity=".35" stroke-width=".8"/>`;
  }).join('');
  const drops = Array.from({ length: 24 }, () => `<circle cx="${n(between(rng, wx, wx + ww))}" cy="${n(between(rng, wy, wy + wh))}" r="${n(between(rng, 0.8, 2))}" fill="#fff" opacity=".35"/>`).join('');
  const candleX = between(rng, 250, 320);
  const stackX = between(rng, 60, 110);
  return [
    backdrop('#2d1d14', '#1a100a', `${id}-wall`),
    `<clipPath id="${id}-pane"><rect x="${wx}" y="${wy}" width="${ww}" height="${wh}"/></clipPath>`,
    `<g clip-path="url(#${id}-pane)">`,
    backdrop('#3e4a6a', '#d58a4a', `${id}-dusk`),
    `<path d="M${wx} 160 Q140 140 220 152 T${wx + ww} 146 L${wx + ww} ${wy + wh} L${wx} ${wy + wh} Z" fill="#3a2a2a"/>`,
    autumnTrees(rng, wx, wx + ww, wy + wh + 8, 6).replace(/fill="#(?:c8602a|d98c2b|a8452a|b9862c|8b3a1f|d2a04a)"/g, (m) => m.replace(/#\w+/, '#6a3324')),
    rain,
    drops,
    `</g>`,
    windowFrame(wx, wy, ww, wh, 2, 2, '#4a2e1c'),
    glow(id, candleX, sill - 50, 160, 0.8),
    `<rect y="${sill}" width="${W}" height="14" fill="#6b4529"/><rect y="${sill}" width="${W}" height="3" fill="#9a6d44"/>`,
    `<rect y="${sill + 14}" width="${W}" height="${H - sill - 14}" fill="#24150d"/>`,
    flatBook(rng, id, stackX, sill, 92, 15),
    flatBook(rng, id, stackX + 6, sill - 15, 82, 14),
    flatBook(rng, id, stackX + 2, sill - 29, 88, 13),
    // a small pumpkin — it is autumn, after all
    `<g transform="translate(${n(stackX + 128)} ${sill - 15})"><ellipse cx="0" cy="0" rx="22" ry="15" fill="#d06d22"/><ellipse cx="-9" cy="0" rx="10" ry="14" fill="#e0812c"/><ellipse cx="9" cy="0" rx="10" ry="14" fill="#c4611c"/><rect x="-2" y="-21" width="4" height="9" rx="2" fill="#5a4a22"/></g>`,
    candle(rng, id, candleX, sill, between(rng, 46, 64)),
  ].join('');
}

function stillLife(rng: Rng, id: string): string {
  const table = 236;
  const cx = between(rng, 150, 230);
  const velvet = pick(rng, [
    ['#2c3a2a', '#151c13'],
    ['#4a1e1c', '#22100e'],
    ['#2a2c40', '#13141f'],
  ] as const);
  const books: string[] = [];
  let y = table;
  const count = 4 + Math.floor(rng() * 3);
  let topWidth = 0;
  let topX = 0;
  for (let i = 0; i < count; i++) {
    const w = between(rng, 150, 210) - i * 10;
    const h = between(rng, 15, 24);
    const x = cx - w / 2 + between(rng, -10, 10);
    books.push(flatBook(rng, id, x, y, w, h));
    y -= h;
    topWidth = w;
    topX = x;
  }
  const inkX = cx > 190 ? cx - 150 : cx + 130;
  return [
    backdrop(velvet[0], velvet[1], `${id}-velvet`),
    ...Array.from({ length: 10 }, (_, i) => `<path d="M${20 + i * 40} 20 q8 12 0 24 q-8 -12 0 -24 M${20 + i * 40} 120 q8 12 0 24 q-8 -12 0 -24" fill="#d8b46a" opacity=".07"/>`),
    glow(id, cx, y - 40, 220, 0.8),
    `<rect y="${table}" width="${W}" height="${H - table}" fill="#4a2c18"/><rect y="${table}" width="${W}" height="3" fill="#7a5232"/>`,
    `<ellipse cx="${n(cx)}" cy="${table + 6}" rx="130" ry="8" fill="#000" opacity=".3"/>`,
    ...books,
    candle(rng, id, topX + topWidth * between(rng, 0.35, 0.65), y, between(rng, 40, 58)),
    // inkwell and quill
    `<rect x="${n(inkX)}" y="${table - 24}" width="30" height="24" rx="5" fill="#1d1a22"/><rect x="${n(inkX + 8)}" y="${table - 31}" width="14" height="8" rx="2" fill="#c39a45"/>`,
    `<path d="M${n(inkX + 15)} ${table - 30} Q${n(inkX + 30)} ${table - 80} ${n(inkX + 58)} ${table - 110} Q${n(inkX + 40)} ${table - 70} ${n(inkX + 17)} ${table - 30} Z" fill="#efe4cf"/>`,
    `<path d="M${n(inkX + 16)} ${table - 30} Q${n(inkX + 34)} ${table - 75} ${n(inkX + 58)} ${table - 110}" stroke="#a89880" stroke-width="1" fill="none"/>`,
  ].join('');
}

const PAINTERS: Record<SceneKind, (rng: Rng, id: string) => string> = {
  shelves,
  lamp,
  nook,
  armchair,
  window: windowsill,
  'still-life': stillLife,
};

export function renderScene(seed: number): Scene {
  const rng = seeded(seed);
  const kind = KINDS[Math.floor(rng() * KINDS.length)] ?? 'shelves';
  const id = `scene-${seed >>> 0}`;
  const body = PAINTERS[kind](rng, id);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>${defs(id)}</defs>${body}${finish(id)}</svg>`;
  return { kind, label: LABELS[kind], svg };
}
