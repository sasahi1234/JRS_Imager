import type { FitMode } from './formats';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 元画像のどこ(src)を、出力のどこ(dst)に描くかを返す。 */
export function computeDrawRect(
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  mode: FitMode,
): { src: Rect; dst: Rect } {
  if (mode === 'stretch') {
    return { src: { x: 0, y: 0, w: sw, h: sh }, dst: { x: 0, y: 0, w: dw, h: dh } };
  }
  if (mode === 'cover') {
    const s = Math.max(dw / sw, dh / sh);
    const w = dw / s;
    const h = dh / s;
    return {
      src: { x: (sw - w) / 2, y: (sh - h) / 2, w, h },
      dst: { x: 0, y: 0, w: dw, h: dh },
    };
  }
  const s = Math.min(dw / sw, dh / sh);
  const w = sw * s;
  const h = sh * s;
  return {
    src: { x: 0, y: 0, w: sw, h: sh },
    dst: { x: (dw - w) / 2, y: (dh - h) / 2, w, h },
  };
}
