import { FORMATS, SLOT_MAX, SLOT_MIN, type FormatId } from './formats';

function assertSlot(n: number): void {
  if (!Number.isInteger(n) || n < SLOT_MIN || n > SLOT_MAX) {
    throw new RangeError(`番号は ${SLOT_MIN}〜${SLOT_MAX} の整数で指定してください: ${n}`);
  }
}

export function slotFileName(n: number): string {
  assertSlot(n);
  return `${String(n).padStart(3, '0')}.png`;
}

export function outputLabel(format: FormatId, n: number): string {
  const f = FORMATS[format];
  return `${f.label}（${f.folder}）用 ${slotFileName(n)}`;
}

export function zipEntryPath(format: FormatId, n: number): string {
  return `${FORMATS[format].folder}/${slotFileName(n)}`;
}
