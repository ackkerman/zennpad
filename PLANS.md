# PLANS

## 目的
ZennPad VS Code 拡張機能のスケルトンを docs/spec.md に沿って整備し、コマンドやビュー構成の骨格を用意する。

## 大枠の方針
- spec.md の要件を踏まえた package.json とコマンド/ビュー登録の scaffold を作成する。
- TreeDataProvider と FileSystemProvider の仮実装を用意し、将来の実装地点を明確にする。
- README にセットアップ/開発フローを記載し、最小限のビルド・テストスクリプトを整える。

## To-Do
- [x] PLANS.md を作成し目的と方針を整理する。
- [x] package.json と TypeScript ビルド設定を追加する。
- [x] TreeDataProvider と FileSystemProvider の仮実装を追加する。
- [x] コマンド登録とエントリーポイントの scaffold を作成する。
- [x] README にセットアップと動作確認方法を追記する。

## 進捗メモ
- VS Code 拡張の最小構成を作成し、仮想 FS とツリービュー、主要コマンドのプレースホルダーを登録した。

## 意思決定ログ
- TypeScript ベースの VS Code 拡張として構成する方針を採用。
- 簡易テストとして `npm test` で lint 代替のプレースホルダーを実行する計画を継続。
