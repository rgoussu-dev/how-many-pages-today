import { describe, expect, it } from 'vitest';
import { BOOKMARK_WOODS, renderBookmark } from './bookmark';

describe('bookmarks', () => {
  it('paints the same bookmark for the same seed', () => {
    expect(renderBookmark(1871)).toEqual(renderBookmark(1871));
  });

  it('covers every kind of woods across seeds', () => {
    const woods = new Set(Array.from({ length: 60 }, (_, seed) => renderBookmark(seed).wood));
    expect(woods).toEqual(new Set(BOOKMARK_WOODS));
  });

  it('produces well-formed, self-contained SVG with no NaN coordinates', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { svg } = renderBookmark(seed * 7919);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/); // nothing fetched
    }
  });

  it('keeps its ids to itself, so two bookmarks on a page never share a gradient', () => {
    expect(renderBookmark(1).svg).toContain('bookmark-1-sky');
    expect(renderBookmark(2).svg).not.toContain('bookmark-1-');
  });
});
