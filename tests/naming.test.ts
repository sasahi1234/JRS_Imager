import { describe, expect, it } from 'vitest';
import { outputLabel, slotFileName, zipEntryPath } from '../src/naming';
import { suggestFormat } from '../src/formats';

describe('slotFileName', () => {
  it('3 桁ゼロ埋めの png 名にする', () => {
    expect(slotFileName(1)).toBe('001.png');
    expect(slotFileName(3)).toBe('003.png');
    expect(slotFileName(10)).toBe('010.png');
  });

  it('範囲外・小数はエラー', () => {
    expect(() => slotFileName(0)).toThrow(RangeError);
    expect(() => slotFileName(11)).toThrow(RangeError);
    expect(() => slotFileName(1.5)).toThrow(RangeError);
  });
});

describe('outputLabel / zipEntryPath', () => {
  it('表示名と ZIP 内パスを作る', () => {
    expect(outputLabel('tall', 3)).toBe('縦長（Tall）用 003.png');
    expect(zipEntryPath('wide', 10)).toBe('Wide/010.png');
  });
});

describe('suggestFormat', () => {
  it('縦横比に近い形式を返す', () => {
    expect(suggestFormat(400, 300)).toBe('wide');
    expect(suggestFormat(300, 400)).toBe('tall');
    expect(suggestFormat(500, 500)).toBe('square');
    expect(suggestFormat(1920, 1080)).toBe('wide');
    expect(suggestFormat(1080, 1920)).toBe('tall');
  });
});
