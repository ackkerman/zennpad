# PLANS

## 目的

ZennPad VS Code 拡張を docs/spec.md の要件に沿って実装するための全タスクを洗い出し、進捗を管理する。

## TODOリスト（チェックボックス）

- Scaffold 準備
  - [x] VS Code 拡張のマニフェスト初期化（名前・displayName・publisher・アイコン設定）
  - [x] Activity Bar 用ビューコンテナー `zennPad` とツリービュー `zennPadExplorer` の登録
  - [x] コマンドプレースホルダー登録（New/Publish/Unpublish/Open/Refresh）
  - [x] TypeScript ビルド環境とスクリプト（compile/watch/test）整備
  - [x] 仮想ファイルシステム `zenn` スキームの FileSystemProvider 仮実装
  - [x] TreeDataProvider のスケルトン実装（Articles/Books/Drafts のダミーデータ）
  - [x] VS Code 開発用の launch/tasks/settings/extensions 設定追加

- 拡張機能コア機能
  - [x] Articles/Books/Drafts以下のファイルをクリックしたらエディターで開く実装
  - [x] Articles/Books/Drafts の Markdown ファイル読み込み・表示実装
  - [x] Frontmatter パース・シリアライズロジック実装

- Github連携
  - [x] GitHub 認証（SecretStorage で PAT 保存/読み出し）
  - [x] GitHub Contents API との read/write/delete 実装（sha 管理・競合検知）
  - [x] 仮想FSと実ストレージの同期（URI → GitHub パス変換、pull/push）
  - [ ] TreeDataProvider を GitHub 上の articles/books 構造から生成（LRU/ステータス表示）
  - [ ] Scrap対応？そもそもScrapはGithubに置かれないから編集できない？

- コマンド実装
  - [x] 新規 Article/Book/Chapter 作成ロジック（slug 自動生成、日付ドラフト命名）
  - [x] Frontmatter 生成・更新ロジック（title/emoji/type/topics/published）
  - [x] Publish/Unpublish コマンドで frontmatter の published 切替
  - [x] Open on Zenn コマンドでブラウザ遷移（公開/下書き URL 判定）
  - [x] 競合時のハンドリング（409 時のメッセージと再取得導線）
  - [x] Markdown プレビュー（Zenn 互換レンダラー/導線）

- プレビュー機能移植（zenn preview + proxy + Webview）
  - ミラー同期レイヤー実装
    - [x] PreviewWorkspace サービスの骨格
    - [x] globalStorageUri 配下に preview-workspace を作成
    - [x] 初回全量同期（仮想 FS → 実ディレクトリ）
    - [x] ファイル保存時に差分同期（onDidSaveTextDocument）
    - [x] （可能なら）FileSystemProvider の writeFile/delete/rename hook で差分同期
    - [x] zenn CLI 未インストール時のエラーメッセージ/導線追加

  - URI ↔ 相対パスマッピング
    - [x] 仮想スキーム (zenn:) から相対 Zenn パス (articles/foo.md, books/bar/...) への変換関数
    - [x] URL パス決定ロジック（.md, config.yaml 処理）は既存の挙動に倣う

  - バックエンド起動ロジック
    - [x] get-port で backendPort（zenn preview） と proxyPort（リバースプロキシ）確保
    - [x] zenn CLI をミラーのルートで spawn（zenn preview --port backendPort）
    - [x] zenn preview 側が立ち上がるまで待機

  - リバースプロキシサーバ
    - [x] /__vscode_zenn_editor_preview_proxy_index/* で踏み台 HTML + control JS を配信
    - [x] それ以外を zenn preview サーバへ透過 proxy
    - [x] control JS（proxyView.js 相当）をバンドル & 配信
    - [x] Webview iframe 側で postMessage ハンドラを用意

  - Webview 側制御
    - [x] WebviewPanel 作成（enableScripts: true）
    - [x] iframe を entrypoint URL で初期ロード
    - [x] extension → Webview への postMessage（change_path）
    - [x] Webview 内 control JS → iframe の src 書き換え実装

  - ファイル変更と自動リロード
    - [x] 保存時にミラー同期 → zenn CLI がファイル監視してるため自動リロード
    - [x] Webview iframe 内でのリロード処理（VL：iframe に対してセマンティックな reload）

- 作りこみ（Phase 2 以降）
  - [ ] スニペット/断片保存と検索（任意機能）
  - [ ] Book/Chapter 紐付け UI（Phase 1: QuickPick/InputBox、Phase 2: Webview Inspector）

- リファクタリング
  - [ ] コード整理（サービス分割、責務分離、命名見直し）
  - [ ] 非同期処理の統一的ハンドリング（async/await 統一、エラーハンドリング）
  - [ ] 型定義強化（any 排除、インターフェース整備）

- 品質向上タスク
  - [ ] UI 変更に伴う screenshot 自動生成フロー（make screenshot-web + scripts/capture_screenshot.py）
  - [ ] Lint/format 導入と CI（GitHub Actions）整備
  - [ ] 単体テスト/統合テスト追加（Commands/FS/Tree）
  - [ ] README 改訂（セットアップ・認証手順・ワークフロー更新）

- Books 機能（開発中）
  - [ ] GitHub 上の books/* 構造から Tree を構築（Book/Chapter 一覧・frontmatter 読込・ソート）
  - [ ] Book/Chapter 作成コマンド（slug 生成、frontmatter 初期値、章テンプレート）
  - [ ] Book/Chapter rename/move/delete（衝突・リンク整合性のハンドリング）
  - [ ] Book の published/非公開状態管理と Open on Zenn (book URL) 生成
  - [ ] Book/Chapter の preview パス解決（zenn preview 用の urlPath 生成）
  - [ ] 競合・同期エラー時の復帰導線（Book/Chapter 向け）

- 時系列ソート（Articles/Books/Drafts）
  - [ ] GitHub commits API で最新コミット日時を取得し更新日時をソートキーに反映（`GET /repos/:owner/:repo/commits?path=<path>&per_page=1`）
  - [ ] 作成日時取得（GraphQL `history(last:1, path:"...")` もしくは REST ページネーションで最古コミットを取得）とキャッシュ保存
  - [ ] メモリ/ローカルキャッシュ（path → {updatedAt, createdAt, sha}）を導入し Refresh 時のみ更新、失敗時は名前ソートにフォールバック
  - [ ] レート制限/タイムアウト時の扱い（警告表示・フォールバック）
  - [ ] Tree 表示と並び順を更新日時順に切替（Articles/Books/Drafts）

- GitHub同期キャッシュ（起動高速化）
  - [ ] `globalStorageUri` 配下に cache.json を保存し、Tree用のメタ（path/type/frontmatter/sha/updatedAtなど）をキャッシュ
  - [ ] 起動時はキャッシュを即ロードして表示、裏で GitHub pull 実行→成功時にキャッシュを更新して再描画
  - [ ] キャッシュ失効ポリシー（例: 10分）とバージョン管理（互換性崩れ時は破棄）
  - [ ] Refresh 時はキャッシュ無視で取得し、成功後キャッシュ更新。失敗時はキャッシュを維持し通知
  - [ ] パース失敗や不整合時のフォールバック（キャッシュ破棄→通常取得）

- 画像挿入（images/ に保存してリンク挿入）
  - [ ] markdown 向けに DocumentPasteEditProvider を登録し、クリップボードの image/png/jpeg を検知
  - [ ] DocumentDropEditProvider を登録し、ドラッグ&ドロップした画像ファイルを検知
  - [ ] 画像ファイル名の生成（日時+拡張子、重複時は -1, -2 などでリネーム）
  - [ ] 画像バイナリを `zenn:/images/<name>` に writeFile し、`![](/images/<name>)` を挿入する edit を返す
  - [ ] 失敗時の通知とフォールバックコマンド（ファイルピッカー経由の `zennpad.insertImageFromFile` を追加）
  - [ ] GitHub 同期フックで images/ 配下の変更も push/pull 対象に含める
  - [ ] 大きな画像や非対応 MIME の扱い（警告／スキップ）

- [ ] identifierを`zenn-pad`に変更

## メモ
- 現状は scaffold 状態。GitHub 連携と frontmatter/publish まわりが未着手。
- UI 開発が走る際は screenshot 自動生成タスクを Makefile + Python スクリプトで用意し、AGENTS.md に利用手順を追記すること。
