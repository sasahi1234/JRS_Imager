export type FormatId = 'square' | 'tall' | 'wide';

export interface DesignFormat {
  id: FormatId;
  label: string;
  folder: string;
  width: number;
  height: number;
}

export const FORMATS: Record<FormatId, DesignFormat> = {
  square: { id: 'square', label: '正方形', folder: 'Square', width: 512, height: 512 },
  tall: { id: 'tall', label: '縦長', folder: 'Tall', width: 384, height: 512 },
  wide: { id: 'wide', label: '横長', folder: 'Wide', width: 512, height: 384 },
};

export const FORMAT_ORDER: FormatId[] = ['square', 'tall', 'wide'];

export const SLOT_MIN = 1;
export const SLOT_MAX = 10;

export type FitMode = 'cover' | 'contain' | 'stretch';

/** 縦横比が最も近い形式を返す。比は対数で比べ、縦長と横長を対称に扱う。 */
export function suggestFormat(w: number, h: number): FormatId {
  const r = Math.log(w / h);
  let best: FormatId = 'square';
  let bestDiff = Infinity;
  for (const id of FORMAT_ORDER) {
    const f = FORMATS[id];
    const diff = Math.abs(r - Math.log(f.width / f.height));
    if (diff < bestDiff) {
      best = id;
      bestDiff = diff;
    }
  }
  return best;
}
