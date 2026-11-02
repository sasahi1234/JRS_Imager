import { computeDrawRect } from './fit';
import {
  FORMATS,
  FORMAT_ORDER,
  SLOT_MAX,
  SLOT_MIN,
  suggestFormat,
  type FitMode,
  type FormatId,
} from './formats';
import { downloadBlob } from './download';
import { outputLabel, slotFileName } from './naming';
import { canvasToPng, resizeToCanvas } from './resize';

const MAX_PIXELS = 100_000_000;
const SUPPORTED = 'PNG / JPEG / WebP / GIF / BMP';

interface State {
  source: ImageBitmap | null;
  format: FormatId;
  autoFormat: boolean;
  slot: number;
  fit: FitMode;
  output: Blob | null;
}

const state: State = {
  source: null,
  format: 'square',
  autoFormat: false,
  slot: 1,
  fit: 'cover',
  output: null,
};

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} がありません`);
  return el as T;
}

const dropzone = $<HTMLLabelElement>('dropzone');
const dropzoneText = $('dropzone-text');
const fileInput = $<HTMLInputElement>('file');
const message = $('message');
const formatsEl = $('formats');
const slotsEl = $('slots');
const fitsEl = $('fits');
const preview = $<HTMLCanvasElement>('preview');
const placeholder = $('placeholder');
const notice = $('notice');
const outputLabelEl = $('output-label');
const downloadBtn = $<HTMLButtonElement>('download');

function showMessage(text: string | null): void {
  message.textContent = text ?? '';
  message.hidden = text === null;
}

function renderFormats(): void {
  formatsEl.replaceChildren(
    ...FORMAT_ORDER.map((id) => {
      const f = FORMATS[id];
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'format';
      input.value = id;
      input.checked = state.format === id;
      label.append(input, ` ${f.label} ${f.folder} `);
      const size = document.createElement('small');
      size.textContent = `${f.width}×${f.height}`;
      label.append(size);
      if (state.autoFormat && state.format === id) {
        const badge = document.createElement('span');
        badge.className = 'auto-badge';
        badge.textContent = '← 自動';
        label.append(badge);
      }
      return label;
    }),
  );
}

function renderSlots(): void {
  const items: HTMLElement[] = [];
  for (let n = SLOT_MIN; n <= SLOT_MAX; n++) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'slot';
    input.value = String(n);
    input.checked = state.slot === n;
    const span = document.createElement('span');
    span.textContent = String(n);
    label.append(input, span);
    items.push(label);
  }
  slotsEl.replaceChildren(...items);
}

function updateNotice(): void {
  const src = state.source;
  if (!src) {
    notice.hidden = true;
    return;
  }
  const f = FORMATS[state.format];
  const notes: string[] = [];
  if (src.width < f.width || src.height < f.height) {
    notes.push('元画像が小さいため拡大します（ぼやける可能性があります）。');
  }
  const ratio = Math.max(
    src.width / src.height / (f.width / f.height),
    f.width / f.height / (src.width / src.height),
  );
  if (state.fit === 'cover' && ratio >= 1.5) {
    notes.push('切り抜かれる部分が多くなります。');
  }
  if (state.fit === 'stretch' && ratio >= 1.5) {
    notes.push('画像が大きく歪みます。');
  }
  notice.textContent = notes.join(' ');
  notice.hidden = notes.length === 0;
}

let renderToken = 0;

async function render(): Promise<void> {
  const src = state.source;
  outputLabelEl.textContent = '';
  if (!src) {
    preview.hidden = true;
    placeholder.hidden = false;
    downloadBtn.disabled = true;
    state.output = null;
    updateNotice();
    return;
  }

  const token = ++renderToken;
  const f = FORMATS[state.format];
  const { src: s, dst } = computeDrawRect(src.width, src.height, f.width, f.height, state.fit);
  const canvas = resizeToCanvas(src, s, dst, f.width, f.height);

  preview.width = canvas.width;
  preview.height = canvas.height;
  preview.getContext('2d')?.drawImage(canvas, 0, 0);
  preview.hidden = false;
  placeholder.hidden = true;

  try {
    const blob = await canvasToPng(canvas);
    if (token !== renderToken) return;
    state.output = blob;
    downloadBtn.disabled = false;
    outputLabelEl.textContent = outputLabel(state.format, state.slot);
    downloadBtn.textContent = `${slotFileName(state.slot)} をダウンロード`;
  } catch (e) {
    if (token !== renderToken) return;
    state.output = null;
    downloadBtn.disabled = true;
    showMessage(e instanceof Error ? e.message : '変換に失敗しました');
  }
  updateNotice();
}

async function loadFile(file: File): Promise<void> {
  showMessage(null);
  if (!file.type.startsWith('image/')) {
    showMessage(`画像ファイルを選んでください（対応形式: ${SUPPORTED}）`);
    return;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    showMessage(`この画像は読み込めませんでした（対応形式: ${SUPPORTED}）`);
    return;
  }
  if (bitmap.width * bitmap.height > MAX_PIXELS) {
    bitmap.close();
    showMessage('画像が大きすぎます（1億画素以下の画像を選んでください）');
    return;
  }

  state.source?.close();
  state.source = bitmap;
  state.format = suggestFormat(bitmap.width, bitmap.height);
  state.autoFormat = true;
  dropzoneText.innerHTML = '';
  dropzoneText.append(`${file.name}（${bitmap.width}×${bitmap.height}）`, document.createElement('br'), 'クリックまたはドロップで変更');
  renderFormats();
  void render();
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void loadFile(file);
  fileInput.value = '';
});

dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

for (const type of ['dragenter', 'dragover']) {
  dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
}
for (const type of ['dragleave', 'drop']) {
  dropzone.addEventListener(type, () => dropzone.classList.remove('dragover'));
}
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files[0];
  if (file) void loadFile(file);
});

// ページのどこかに誤ってドロップしても、ブラウザが画像を開いてしまわないようにする
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

formatsEl.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement;
  state.format = t.value as FormatId;
  state.autoFormat = false;
  renderFormats();
  void render();
});

slotsEl.addEventListener('change', (e) => {
  state.slot = Number((e.target as HTMLInputElement).value);
  void render();
});

fitsEl.addEventListener('change', (e) => {
  state.fit = (e.target as HTMLInputElement).value as FitMode;
  void render();
});

downloadBtn.addEventListener('click', () => {
  if (state.output) downloadBlob(state.output, slotFileName(state.slot));
});

renderFormats();
renderSlots();
void render();
