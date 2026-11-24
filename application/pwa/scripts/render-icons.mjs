// Renders the PNG icons the web app manifest and iOS need from public/icons/favicon.svg.
// Uses the Playwright Chromium available in the dev environment; run `npm run icons`
// after editing the SVG, and commit the PNGs.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const dir = fileURLToPath(new URL('../public/icons/', import.meta.url));
const svg = await readFile(`${dir}favicon.svg`, 'utf8');

/** [file, size, padding ratio, background, rounded] */
const targets = [
  ['icon-192.png', 192, 0, null, true],
  ['icon-512.png', 512, 0, null, true],
  ['apple-touch-icon.png', 180, 0, null, false],
  // maskable: full-bleed background, artwork inside the 80% safe zone
  ['icon-maskable-512.png', 512, 0.12, '#b9532f', false],
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const [file, size, pad, background, rounded] of targets) {
  const art = rounded ? svg : svg.replace('rx="112"', 'rx="0"');
  const inset = size * pad;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:${background ?? 'transparent'}">` +
      `<div style="position:absolute;inset:${inset}px">${art.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`,
  );
  await writeFile(`${dir}${file}`, await page.screenshot({ omitBackground: background === null }));
  console.log(`wrote ${file}`);
}

// Android status-bar badge: a white silhouette on transparent (the platform uses the alpha).
await page.setViewportSize({ width: 96, height: 96 });
await page.setContent(
  `<html><body style="margin:0;background:transparent"><svg width="96" height="96" viewBox="0 0 512 512">` +
    `<path d="M256 168c-46-30-104-38-160-30v214c56-8 114 0 160 30 46-30 104-38 160-30V138c-56-8-114 0-160 30z" fill="#fff"/></svg></body></html>`,
);
await writeFile(`${dir}badge-96.png`, await page.screenshot({ omitBackground: true }));
console.log('wrote badge-96.png');
await browser.close();
