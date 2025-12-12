# ZennPad

ZennPad は Zenn 記事/Book を VS Code のサイドバーから操作するための拡張機能です。docs/spec.md の要件に沿った最小限のスケルトンを提供します。

## 構成

- Activity Bar に Zenn ビューコンテナーを追加し、`Zenn` ツリービューを表示
- 仮想ファイルシステム `zenn:` スキームを登録
- 主要コマンドをプレースホルダーとして登録

## セットアップ

1. コンパイル

    ```bash
    pnpm install
    pnpm run compile
    ```

2. VS Code で拡張を起動
    - `Run Extension` 構成を使用してデバッグモードで起動

3. `Zenn` ビューとコマンドを確認

## テスト

自動テストは未整備です。`npm test` ではプレースホルダー出力のみを実行します。必要に応じて `npm run compile` でビルド確認してください。
