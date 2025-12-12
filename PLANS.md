# PLANS

## 目的
ZennPad VS Code 拡張を docs/spec.md の要件に沿って実装するための全タスクを洗い出し、進捗を管理する。

## TODOリスト（チェックボックス）
- [x] VS Code 拡張のマニフェスト初期化（名前・displayName・publisher・アイコン設定）
- [x] Activity Bar 用ビューコンテナー `zennPad` とツリービュー `zennPadExplorer` の登録
- [x] コマンドプレースホルダー登録（New/Publish/Unpublish/Open/Refresh）
- [x] TypeScript ビルド環境とスクリプト（compile/watch/test）整備
- [x] 仮想ファイルシステム `zenn` スキームの FileSystemProvider 仮実装
- [x] TreeDataProvider のスケルトン実装（Articles/Books/Drafts のダミーデータ）
- [x] VS Code 開発用の launch/tasks/settings/extensions 設定追加
- [ ] GitHub 認証（SecretStorage で PAT 保存/読み出し）
- [ ] GitHub Contents API との read/write/delete 実装（sha 管理・競合検知）
- [ ] 仮想FSと実ストレージの同期（URI → GitHub パス変換、pull/push）
- [ ] TreeDataProvider を GitHub 上の articles/books 構造から生成（LRU/ステータス表示）
- [ ] 新規 Article/Book/Chapter 作成ロジック（slug 自動生成、日付ドラフト命名）
- [ ] Frontmatter 生成・更新ロジック（title/emoji/topics/published）
- [ ] Publish/Unpublish コマンドで frontmatter の published 切替
- [ ] Open on Zenn コマンドでブラウザ遷移（公開/下書き URL 判定）
- [ ] 競合時のハンドリング（409 時のメッセージと再取得導線）
- [ ] Markdown プレビュー（Zenn 互換レンダラー/導線）
- [ ] スニペット/断片保存と検索（任意機能）
- [ ] Book/Chapter 紐付け UI（Phase 1: QuickPick/InputBox、Phase 2: Webview Inspector）
- [ ] UI 変更に伴う screenshot 自動生成フロー（make screenshot-web + scripts/capture_screenshot.py）
- [ ] Lint/format 導入と CI（GitHub Actions）整備
- [ ] 単体テスト/統合テスト追加（Commands/FS/Tree）
- [ ] README 改訂（セットアップ・認証手順・ワークフロー更新）

## メモ
- 現状は scaffold 状態。GitHub 連携と frontmatter/publish まわりが未着手。
- UI 開発が走る際は screenshot 自動生成タスクを Makefile + Python スクリプトで用意し、AGENTS.md に利用手順を追記すること。
