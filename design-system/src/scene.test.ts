import { describe, expect, it } from 'vitest';
import { renderScene } from './scene';

describe('card scenes', () => {
  it('paints the same picture for the same seed', () => {
    expect(renderScene(42)).toEqual(renderScene(42));
  });

  it('covers every kind of scene across seeds', () => {
    const kinds = new Set(Array.from({ length: 200 }, (_, seed) => renderScene(seed).kind));
    expect(kinds).toEqual(new Set(['shelves', 'lamp', 'nook', 'armchair', 'window', 'still-life']));
  });

  it('paints a chosen scene when asked', () => {
    expect(renderScene(42, 'lamp').kind).toBe('lamp');
    expect(renderScene(42, 'lamp')).toEqual(renderScene(42, 'lamp'));
  });

  it('describes itself in the language asked for, English otherwise', () => {
    expect(renderScene(42, 'lamp', 'fr-CA').label).toMatch(/^Une lampe de banquier/);
    expect(renderScene(42, 'lamp', 'de').label).toMatch(/^A green banker's lamp/);
    expect(renderScene(42, 'lamp', 'fr').svg).toBe(renderScene(42, 'lamp').svg);
  });

  it('produces well-formed, self-contained SVG with no NaN coordinates', () => {
    for (let seed = 0; seed < 300; seed++) {
      const { svg } = renderScene(seed * 7919);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/); // nothing fetched
    }
  });
});
