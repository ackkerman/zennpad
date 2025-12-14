# ZennPad

ZennPad は「Zenn への投稿準備を VS Code だけで完結させたい」というニーズに応える拡張機能です。記事の作成・編集・公開ステータスの切替、画像貼り付け、プレビューまでをサイドバー中心のワークフローでまとめ、GitHub との行き来や zenn CLI の起動を意識しないで済むようにします。

## できること / 解消するペイン

- **Zennコンテンツの見える化と編集**: Articles/Drafts/Images をツリーで一覧。クリックで即編集、ドラフトはラベルで判別。
- **記事の生成と公開状態切替**: 日付入り slug 付きで新規作成、frontmatter の `published` をコマンドひとつでオン/オフ。
- **画像まわりの手間削減**: クリップボードやドラッグ&ドロップの画像を `/images/xxx` に自動保存し、Markdown の `![](/images/xxx)` を挿入。手元の画像ファイルも同様に挿入可能。
- **ワンクリックプレビュー**: `ZennPad: Preview` で zenn CLI を裏で起動し、Webview で動作確認。ローカル画像も 404 なく表示。
- **URL やコピー操作の効率化**: Zenn/GitHub URL のコピー、パスコピー、リポ/プロフィールをブラウザで開く導線を用意。
- **サインインと同期**: VS Code の GitHub 認証を使い、リポジトリを選んでからはサイドバー操作だけで pull/push/デプロイを回せます。

## はじめ方（ユーザー）

1. VS Code で拡張をインストールし、`Developer: Reload Window` 後に Activity Bar の ZennPad アイコンを開く。
2. コマンドパレットで `ZennPad: Sign in to GitHub` を実行し、表示に従ってサインイン（Sign out は `ZennPad: Sign out of GitHub`）。
3. 設定で `zennpad.githubOwner` / `zennpad.githubRepo` を入力するか、`ZennPad: Choose GitHub Repository` で選択。
4. `ZennPad: Refresh` を実行してリポの articles/images を読み込み、以降はツリーから編集・プレビュー・公開切替を行う。
5. 画像を貼る場合はエディタ上でペースト or ドロップ or `ZennPad: Insert Image from File` を実行。

動作に必要なもの:
- VS Code 1.85+
- GitHub アカウント（`repo` 権限の認証）
- `zenn` CLI が PATH にあること（プレビュー用）

## ヘルプになりやすいコマンド

- `ZennPad: New Article` — 日付入り slug と frontmatter を含む記事を作成
- `ZennPad: Publish Article` / `ZennPad: Unpublish Article` — 公開/非公開の切替
- `ZennPad: Preview` — 現在の Markdown を zenn 互換でプレビュー
- `ZennPad: Refresh` — GitHub から記事・画像を取得して最新化
- `ZennPad: Insert Image from File` — ローカル画像を `/images` に保存し Markdown へ挿入
- `ZennPad: Copy Zenn URL` / `Copy GitHub URL` — 選択中コンテンツの URL をクリップボードへ
- `ZennPad: Deploy Pending Changes to Zenn` — 変更をまとめて Zenn 用ブランチへ反映

## 開発者向けオンボーディング

読む順番の目安:
1. `docs/spec.md`（必須）
2. `src/` の主要ディレクトリ: `commands/`, `github/`, `preview/`, `ui/`
3. `src/__tests__/` のテスト構造

変更するときのルール:
- 「spec → code → test」の順に整合を取ること
- PR には spec 更新要否（要/不要と理由）を必ず書くこと

開発用コマンド:
- セットアップ: `pnpm install`
- ビルド: `pnpm run compile`
- テスト: `pnpm test`
- Lint/Format: `pnpm run lint` / `pnpm run format`
