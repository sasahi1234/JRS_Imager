import type { Rect } from './fit';

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function context(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas を利用できません');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

/**
 * source の src 範囲を、dw×dh の Canvas の dst 範囲に描く。
 * 大きく縮小するときは半分ずつ段階的に縮めて、ジャギーやモアレを抑える。
 * 背景は塗らない（透過を保つ）。
 */
export function resizeToCanvas(
  source: CanvasImageSource,
  src: Rect,
  dst: Rect,
  dw: number,
  dh: number,
): HTMLCanvasElement {
  let cur: CanvasImageSource = source;
  let cx = src.x;
  let cy = src.y;
  let cw = src.w;
  let ch = src.h;

  while (cw / 2 >= dst.w * 1.5 && ch / 2 >= dst.h * 1.5) {
    const step = makeCanvas(cw / 2, ch / 2);
    context(step).drawImage(cur, cx, cy, cw, ch, 0, 0, step.width, step.height);
    cur = step;
    cx = 0;
    cy = 0;
    cw = step.width;
    ch = step.height;
  }

  const out = makeCanvas(dw, dh);
  context(out).drawImage(cur, cx, cy, cw, ch, dst.x, dst.y, dst.w, dst.h);
  return out;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('変換に失敗しました'))), 'image/png');
  });
}
