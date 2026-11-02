# JRS_Imager

Real Ramen Simulator のマイデザイン用画像を、自動でリサイズ・リネームしてダウンロードできる Web ツールです。
画像はサーバーに送らず、ブラウザの中だけで処理します。

| 形式 | フォルダ | サイズ |
| --- | --- | --- |
| 正方形 | `Square` | 512 × 512 |
| 縦長 | `Tall` | 384 × 512 |
| 横長 | `Wide` | 512 × 384 |

1. 画像を選ぶ
2. 形式と番号（1〜10）を選ぶ
3. `001.png` 〜 `010.png` の名前でダウンロードされる

ゲームの `Designs\<形式>\` フォルダへの置き換えは各自で行ってください。

> 非公式ツールです。置き換える前に `Designs` フォルダをバックアップしておくと安心です。

## ドキュメント

- [要件定義書](docs/requirements.md)
- [設計書](docs/design.md)

## 開発

```bash
npm install
npm run dev     # http://localhost:5173/JRS_Imager/
npm test
npm run build
```

main への push で GitHub Actions が GitHub Pages に公開します（リポジトリの Settings → Pages → Source を「GitHub Actions」にしてください）。

## 状態

MVP（FR-01〜FR-10）を実装済みです。まだ GitHub には公開していません。
