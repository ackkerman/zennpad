# Quickstart: ZennPad VS Code拡張

## Prerequisites
- VS Code >= 1.85
- Node.js 18+ / pnpm 10+ (`corepack enable`)
- GitHubアカウント（Contents+Git Dataアクセス許可）、Zenn CLI (preview用)

## Setup
1) 依存インストール: `pnpm install`  
2) ビルド: `pnpm compile` または開発ウォッチ `pnpm watch`  
3) テスト: `pnpm test`（tsc→node --test）、`pnpm lint`, `pnpm format`  
4) 拡張デバッグ: VS Codeで「Launch Extension」を選択してF5起動。

## GitHub & リポ設定
1) コマンドパレットで「ZennPad: Sign In」→ブラウザ認証（またはPAT登録）。  
2) Settings Panelで `githubOwner` / `githubRepo` / `mainBranch` / `workBranch` / `zennAccount` を入力。  
3) ワークブランチに自動同期、メインは手動デプロイ。デプロイ前に確認ダイアログあり。

## 主要フロー
- **編集/プレビュー**: ツリービューから記事を開き、`Preview` でローカルミラー経由プレビュー。保存で自動リロード。  
- **新規作成**: コマンド/ツリーから Article/Book/Chapter/Draft を作成（テンプレ+フロントマター自動付与）。  
- **公開切替**: Publish/Unpublishでfrontmatter更新、Zenn/GitHubリンクが状態に応じて変化。  
- **画像挿入**: 貼り付け/ドラッグ/ファイル選択で `/images/<name>` に保存しMarkdownリンクを挿入。3MB超は警告・中断。  
- **検索**: Searchビューでキーワードとトグル（Aa, ab|, .*）を設定し、結果からジャンプ。  
- **同期/デプロイ**: 自動同期デバウンス、`Flush Pending Sync` で手動反映、`DeployToZenn` でメインへ。429/409時は通知と再試行導線。

## UI検証
- Webview/ツリーUIを変更した場合は `make screenshot-web` を実行し、`scripts/capture_screenshot.py` でプレビュー画像を生成・確認すること。

## トラブルシュート
- 認証失敗/期限切れ: サインアウト→再サインイン。  
- プレビュー起動失敗: ポート占有を確認→再試行、Zenn CLI導入を案内。  
- コンフリクト: 409表示に従い再取得または手動マージ→再同期。  
- レート制限: 通知のバックオフ時間を待って再実行。
