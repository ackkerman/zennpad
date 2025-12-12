# ZennPad

ZennPad は Zenn 記事/Book を VS Code のサイドバーから操作するための拡張機能です。docs/spec.md の要件に沿った最小限のスケルトンを提供します。

## 構成
- Activity Bar に Zenn ビューコンテナーを追加し、`Zenn` ツリービューを表示
- 仮想ファイルシステム `zenn:` スキームを登録
- 主要コマンドをプレースホルダーとして登録

## セットアップ
```bash
npm install
npm run compile
```

## 開発の流れ
1. `npm install` で依存関係を取得
2. `npm run compile` で TypeScript をビルド
3. VS Code の `Run Extension` 構成から拡張を起動し、`Zenn` ビューとコマンドを確認

## テスト
自動テストは未整備です。`npm test` ではプレースホルダー出力のみを実行します。必要に応じて `npm run compile` でビルド確認してください。
