# JRS_Imager 設計書

| 項目 | 内容 |
| --- | --- |
| 版数 | 0.1（初版） |
| 作成日 | 2026-11-02 |
| 関連文書 | [要件定義書](requirements.md) |

---

## 1. 方式

### 1.1 全体構成

**サーバーを持たない静的 Web アプリ** とし、画像処理はすべてブラウザ内（Canvas API）で行う。

```
┌──────────────── 利用者のブラウザ ────────────────┐
│                                                   │
│  画像ファイル ──▶ 読み込み ──▶ リサイズ ──▶ PNG 書き出し ──▶ ダウンロード
│  (ローカル)       (File API)   (Canvas)    (toBlob)        (a[download])
│                                                   │
└───────────────────────────────────────────────────┘
          ▲  HTML / JS / CSS を配信するだけ
┌─────────┴─────────┐
│  GitHub Pages     │   ← main への push で GitHub Actions が自動ビルド・公開
└───────────────────┘
```

選定理由:

| 観点 | 理由 |
| --- | --- |
| プライバシー（NFR-02） | 画像が端末の外に出ない。 |
| 費用（NFR-03） | GitHub Pages は無料。サーバー・DB の運用が不要。 |
| 公開（NFR-01） | URL を共有するだけで友人が使える。 |
| 性能（NFR-07） | 512 px 程度の出力なら Canvas で十分高速。 |

### 1.2 技術スタック

| 区分 | 採用 | 備考 |
| --- | --- | --- |
| 言語 | TypeScript | 型でサイズ定義やファイル名規則の取り違えを防ぐ。 |
| ビルド | Vite | 設定が少なく、静的ファイルとして出力できる。 |
| UI | フレームワークなし（素の DOM 操作） | 1 画面・小規模のため。規模が増えたら Preact などを検討。 |
| ZIP 生成（FR-11） | fflate | 軽量。MVP では不要。 |
| テスト | Vitest | 純粋関数（寸法計算・ファイル名生成）を対象。 |
| ホスティング | GitHub Pages | `https://<GitHubユーザー名>.github.io/JRS_Imager/` |
| CI/CD | GitHub Actions | push 時に テスト → ビルド → 公開。 |

## 2. ディレクトリ構成

```
JRS_Imager/
├── .github/workflows/deploy.yml   … ビルドと GitHub Pages への公開
├── docs/
│   ├── requirements.md            … 要件定義書
│   └── design.md                  … 本書
├── public/                        … favicon など
├── src/
│   ├── main.ts                    … 画面の状態管理・イベントの結線・プレビュー（UI は規模が小さいためここに集約）
│   ├── formats.ts                 … 形式の定義（サイズ・フォルダ名）
│   ├── fit.ts                     … 合わせ方ごとの描画範囲の計算（純粋関数）
│   ├── resize.ts                  … Canvas による高品質リサイズ
│   ├── naming.ts                  … 出力ファイル名・表示名の生成
│   ├── download.ts                … Blob のダウンロード
│   └── style.css
├── tests/
│   ├── fit.test.ts
│   └── naming.test.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts                 … base: '/JRS_Imager/'
```

## 3. データ定義

### 3.1 形式（`formats.ts`）

```ts
export type FormatId = 'square' | 'tall' | 'wide';

export interface DesignFormat {
  id: FormatId;
  label: string;      // 画面表示名
  folder: string;     // Designs 配下のフォルダ名（表示と ZIP 内のパスに使う）
  width: number;
  height: number;
}

export const FORMATS: Record<FormatId, DesignFormat> = {
  square: { id: 'square', label: '正方形', folder: 'Square', width: 512, height: 512 },
  tall:   { id: 'tall',   label: '縦長',   folder: 'Tall',   width: 384, height: 512 },
  wide:   { id: 'wide',   label: '横長',   folder: 'Wide',   width: 512, height: 384 },
};

export const SLOT_MIN = 1;
export const SLOT_MAX = 10;
```

### 3.2 合わせ方

```ts
export type FitMode = 'cover' | 'contain' | 'stretch';
// cover   … 切り抜き（初期値）
// contain … 全体を収める（余白は透明）
// stretch … 引き伸ばし
```

### 3.3 画面の状態

```ts
interface AppState {
  source: ImageBitmap | null;  // 読み込んだ画像
  sourceName: string | null;   // 元のファイル名（表示用）
  format: FormatId;            // 初期値は suggestFormat() の結果
  slot: number;                // 1〜10、初期値 1
  fit: FitMode;                // 初期値 'cover'
  output: Blob | null;         // 変換結果の PNG
}
```

状態が変わるたびに「再変換 → プレビュー更新」を行う（出力が小さいので毎回作り直してよい）。

## 4. 処理設計

### 4.1 処理の流れ

```
[画像を選ぶ / ドロップ]
        │
        ▼
 ① 読み込み    createImageBitmap(file)  ※失敗時はエラー表示
        │
        ▼
 ② 形式の提案  suggestFormat(w, h) → state.format
        │
        ▼
 ③ 変換        computeDrawRect() → resizeToCanvas() → canvas.toBlob('image/png')
        │                        ▲
        ▼                        │ 形式・番号・合わせ方を変えたら ③ からやり直す
 ④ プレビュー表示 ────────────────┘
        │
        ▼
[ダウンロード] → slotFileName(slot) の名前で保存（ここで完了）
```

### 4.2 形式の自動提案（FR-03）

縦横比の対数の差が最も小さい形式を選ぶ。

```ts
function suggestFormat(w: number, h: number): FormatId {
  const r = Math.log(w / h);
  // 各形式の比: square = 1, tall = 0.75, wide = 1.333…
  return minBy(Object.values(FORMATS), f => Math.abs(r - Math.log(f.width / f.height))).id;
}
```

対数を使うのは、縦長と横長を対称に扱うため（3:4 と 4:3 が 1:1 から同じ距離になる）。

### 4.3 描画範囲の計算（`fit.ts`、FR-06）

元画像 `(sw, sh)` を出力 `(dw, dh)` に描くとき、元画像のどこを切り出し（src）、出力のどこに描くか（dst）を返す純粋関数とする。

```ts
interface Rect { x: number; y: number; w: number; h: number }
function computeDrawRect(sw, sh, dw, dh, mode: FitMode): { src: Rect; dst: Rect }
```

| 合わせ方 | 計算 |
| --- | --- |
| cover | `s = max(dw/sw, dh/sh)`。元画像から `dw/s × dh/s` の領域を **中央** で切り出し、出力全体に描く。 |
| contain | `s = min(dw/sw, dh/sh)`。元画像全体を `sw·s × sh·s` で出力の中央に描く。余白は透明のまま。 |
| stretch | 元画像全体を出力全体に描く。 |

FR-12（位置調整）を入れるときは、cover の切り出し位置を中央固定から `offsetX/offsetY`（-1〜1）と `zoom`（≧1）で動かせるよう引数を増やす。

### 4.4 高品質リサイズ（`resize.ts`、NFR-06）

ブラウザの `drawImage` で一気に大きく縮小するとジャギーやモアレが出やすい。そのため:

1. 切り出し後の領域が出力の 2 倍を超える間は、**半分ずつ段階的に縮小** する（中間 Canvas を使う）。
2. 最後の 1 回で出力サイズに描く。
3. すべての描画で `imageSmoothingEnabled = true`、`imageSmoothingQuality = 'high'` を指定する。
4. 背景は塗らない（透明のまま）。これで透過 PNG の透過を保ち、contain の余白も透明になる。

画質が不十分な場合は、Lanczos 補間を行うライブラリ（pica など）に差し替えられるよう、`resizeToCanvas(source, drawRect, dw, dh): HTMLCanvasElement` の 1 関数に閉じ込める。

### 4.5 ファイル名と表示名（`naming.ts`、FR-08・FR-10）

```ts
slotFileName(3)              // → '003.png'
outputLabel('tall', 3)       // → '縦長（Tall）用 003.png'
zipEntryPath('tall', 3)      // → 'Tall/003.png'（FR-11 用）
```

- 番号は `SLOT_MIN`〜`SLOT_MAX` の整数のみ受け付け、範囲外は例外とする。
- 3 桁ゼロ埋めは `String(n).padStart(3, '0')`。

### 4.6 ダウンロード（`download.ts`、FR-09）

`URL.createObjectURL(blob)` で URL を作り、`<a download="003.png">` をクリックさせ、終わったら `URL.revokeObjectURL` で解放する。

本サービスの処理はここで終わる。ゲームフォルダへの置き換えは利用者が行う。

## 5. 画面設計

### 5.1 レイアウト（PC）

```
┌────────────────────────────────────────────────────────────┐
│  JRS_Imager  マイデザイン画像 変換ツール                    │
├───────────────────────────────┬────────────────────────────┤
│ ① 画像を選ぶ                   │  プレビュー                │
│ ┌───────────────────────────┐ │  ┌──────────────────────┐ │
│ │  ここに画像をドロップ       │ │  │                      │ │
│ │  または [ファイルを選ぶ]    │ │  │   (384 × 512)        │ │
│ └───────────────────────────┘ │  │                      │ │
│                               │  └──────────────────────┘ │
│ ② 形式                        │                            │
│ (●) 縦長 Tall  384×512 ← 自動  │  [ 003.png をダウンロード ] │
│ ( ) 横長 Wide  512×384         │                            │
│ ( ) 正方形 Square 512×512      │  縦長（Tall）用 003.png     │
│                               │                            │
│ ③ 番号                        │                            │
│ [1][2][3][4][5][6][7][8][9][10]│                            │
│                               │                            │
│ ④ 合わせ方                    │                            │
│ (●) 切り抜き ( ) 全体 ( ) 伸ばす │                            │
├───────────────────────────────┴────────────────────────────┤
│                                         ※非公式ツールです   │
└────────────────────────────────────────────────────────────┘
```

スマートフォンでは左右を縦に並べる（NFR-05）。

### 5.2 表示ルール

| 状況 | 表示 |
| --- | --- |
| 画像未選択 | プレビューに「画像を選んでください」、ダウンロードボタンは無効。 |
| 自動提案した形式 | 「← 自動」の印を付ける。利用者が変えたら印を消す。 |
| 元画像が出力より小さい | 「元画像が小さいため拡大します（ぼやける可能性があります）」と注意を出す。 |
| 縦横比が形式と大きく違う（比の差が 1.5 倍以上） | 「切り抜かれる部分が多くなります」と注意を出す。 |
| 読み込み失敗 | 「この画像は読み込めませんでした（対応形式: PNG / JPEG / WebP / GIF / BMP）」。 |

## 6. エラー処理

| エラー | 対応 |
| --- | --- |
| 画像以外のファイル | 読み込み前に MIME タイプで弾き、メッセージを出す。 |
| 壊れた画像 / 非対応形式 | `createImageBitmap` の例外を捕まえてメッセージを出す。 |
| 極端に大きい画像（例: 1 億画素超） | 読み込み前に警告し、続けるか確認する（メモリ不足でタブが落ちるのを防ぐ）。 |
| `toBlob` が null を返す | 「変換に失敗しました」と出し、再試行できるようにする。 |

## 7. テスト方針

| 種類 | 対象 | 内容 |
| --- | --- | --- |
| 単体（Vitest） | `fit.ts` | 3 つの合わせ方 × 横長・縦長・正方形・極端な比の元画像で、src/dst が正しい範囲に収まること。 |
| 単体（Vitest） | `naming.ts` | 1 → `001.png`、10 → `010.png`、0・11・小数でエラー。 |
| 単体（Vitest） | `suggestFormat` | 4:3 → wide、3:4 → tall、1:1 → square、16:9 → wide、9:16 → tall。 |
| 手動 | 画面 | 主要 4 ブラウザで、読み込み → 変換 → ダウンロード、出力 PNG のサイズ・透過を確認。 |
| 受け入れ | 出力ファイル | 3 形式 × 番号 1・10 で、ダウンロードしたファイルの名前（`001.png` / `010.png`）と縦横のピクセル数が仕様どおりであること。 |

## 8. ゲームでの確認結果

調査で、PNG と対になる JSON に `PngSha256`（PNG の SHA-256）が保存されていることが分かった。
そのため PNG だけ差し替えて反映されるかを利用者に確認してもらった（2026-11-02）。

| 項目 | 結果 | 設計への反映 |
| --- | --- | --- |
| PNG の置き換え（Q-1） | **反映される**。ファイル名は `001.png`〜`010.png`。 | 出力は PNG のみ。JSON の生成・更新は行わない。 |
| `DataHash`（Q-2） | 扱わないため不要。 | — |

置き換えとゲームへの反映確認は利用者が行うため、**要件はダウンロードできた時点で満たされる** ものとする。

## 9. 公開（デプロイ）

1. GitHub に公開リポジトリ `JRS_Imager` を作り、push する。
2. リポジトリの Settings → Pages → Source を「GitHub Actions」にする。
3. `.github/workflows/deploy.yml` で、main への push 時に以下を行う。
   - `npm ci` → `npm test` → `npm run build`
   - `actions/upload-pages-artifact` で `dist/` を上げ、`actions/deploy-pages` で公開する。
4. 公開 URL `https://<GitHubユーザー名>.github.io/JRS_Imager/` を友人に共有する。

`vite.config.ts` の `base` はリポジトリ名に合わせて `'/JRS_Imager/'` にする。

## 10. 実装の順序

| 段階 | 内容 | 対応要件 |
| --- | --- | --- |
| 1 | Vite + TypeScript の雛形、GitHub Pages への自動公開 | NFR-01, NFR-10 |
| 2 | `formats` / `fit` / `naming` と単体テスト | FR-03, FR-05, FR-06, FR-08 |
| 3 | 読み込み・リサイズ・プレビュー・ダウンロードの画面 | FR-01〜FR-10 |
| 4 | 友人に使ってもらい改善（MVP 公開） | — |
| 5 | まとめて変換（ZIP）、位置・拡大率の調整 | FR-11, FR-12 |
