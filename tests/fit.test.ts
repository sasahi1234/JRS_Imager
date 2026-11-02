import { describe, expect, it } from 'vitest';
import { computeDrawRect } from '../src/fit';

describe('computeDrawRect', () => {
  it('cover: 横長の元画像を正方形に中央で切り抜く', () => {
    const { src, dst } = computeDrawRect(2000, 1000, 512, 512, 'cover');
    expect(src).toEqual({ x: 500, y: 0, w: 1000, h: 1000 });
    expect(dst).toEqual({ x: 0, y: 0, w: 512, h: 512 });
  });

  it('cover: 縦長の元画像を横長に切り抜く', () => {
    const { src } = computeDrawRect(1000, 2000, 512, 384, 'cover');
    expect(src.w).toBe(1000);
    expect(src.h).toBeCloseTo(750);
    expect(src.y).toBeCloseTo(625);
  });

  it('contain: 横長の元画像を正方形の中央に収める', () => {
    const { src, dst } = computeDrawRect(2000, 1000, 512, 512, 'contain');
    expect(src).toEqual({ x: 0, y: 0, w: 2000, h: 1000 });
    expect(dst).toEqual({ x: 0, y: 128, w: 512, h: 256 });
  });

  it('stretch: 全体を枠いっぱいに描く', () => {
    const { src, dst } = computeDrawRect(300, 700, 512, 384, 'stretch');
    expect(src).toEqual({ x: 0, y: 0, w: 300, h: 700 });
    expect(dst).toEqual({ x: 0, y: 0, w: 512, h: 384 });
  });

  it('cover: 同じ比なら切り抜かない', () => {
    const { src } = computeDrawRect(1024, 768, 512, 384, 'cover');
    expect(src).toEqual({ x: 0, y: 0, w: 1024, h: 768 });
  });
});
