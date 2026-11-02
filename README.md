# Photo Flick Sorter

Nuxt 3 / TypeScript / IndexedDBで作るスマホ向け写真分類MVPです。

## MVP実装計画

1. Nuxt 3をSPA静的生成構成にする
   - `ssr: false`
   - `nuxt generate`でGitHub Pages向けに出力
   - `NUXT_APP_BASE_URL`でリポジトリ配下公開に対応
2. IndexedDB保存層を作る
   - `categories`: 保存先カテゴリとフリック方向
   - `photos`: 分類済み写真Blobと分類情報
   - `drafts`: 撮影直後で分類待ちの写真
3. MVP画面を実装する
   - ホーム
   - 保存先カテゴリ設定
   - 撮影
   - フリック分類
   - カテゴリ別写真一覧
   - 写真詳細
4. スマホ操作を優先する
   - `input capture="environment"`でカメラ撮影
   - Pointer Eventsで上下左右フリック判定
   - 方向別のカテゴリ割り当てを画面に常時表示
5. デモ品質の確認
   - `npm install`
   - `npm run generate`
   - スマホブラウザまたは開発者ツールのモバイル表示で操作確認

## GitHub Pages

リポジトリ名がサブパスになる場合は次のように生成します。

```bash
NUXT_APP_BASE_URL=/your-repo-name/ npm run generate
```
