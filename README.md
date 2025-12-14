# ZennPad

VS Code のサイドバーから Zenn 記事/本/画像をまとめて管理する拡張機能です。GitHub リポジトリを仮想ファイルシステムとして扱い、作成・公開切替・画像挿入・プレビュー・デプロイまでを UI ドリブンで回せます。

## 主要機能

- サイドバー管理: Repositories ビューに articles/drafts/books/images/files をツリー表示。クリックで即オープン、コンテキストメニューでリネーム/複製/削除、Zenn/GitHub へのリンクコピーやブラウザーオープンが可能。
- GitHub 連携と自動同期: GitHub 認証とリポジトリ選択に対応。`zennpad.workBranch`（デフォルト zenn-work）へ自動同期し、`Deploy to Zenn` で main ブランチへ反映。自動同期は一時停止/再開やフラッシュ（`Flush Pending Sync`）ができ、ステータスバーに反映。
- コンテンツ生成と公開制御: `New Article` で日付入り slug と frontmatter を自動生成。Book/Chapter も作成可能。`Publish` / `Unpublish` で frontmatter の `published` を切り替え、Open on Zenn で公開 URL を開く。
- プレビュー: zenn CLI をバックエンドにした Webview プレビュー（リバースプロキシ付き）。`Preview` コマンドでアクティブな Markdown を同期・起動し、/images へのリクエストもローカルで解決。
- 画像の取り込み: Markdown へ貼り付け・ドラッグ＆ドロップした画像を `/images/<timestamp>.<ext>` に保存し、`![](/images/...)` を自動挿入。ファイル選択からの挿入も `Insert Image from File` で対応。
- 検索ビュー: ファイル名/タイトル/本文を横断検索できる Search ビュー（ケース/単語/正規表現トグル付き）。結果から該当ファイルを直接開けます。
- アクション & ヘルプ: Actions ビューから Sign in、設定パネル、Zenn プロフィール、ヘルプリンク（外部 or プレビュー deep link）へアクセス。
- リンク & パス操作: Zenn/GitHub URL コピー、パスコピー（絶対/相対）、Zenn/GitHub ルートをブラウザーで開く導線を用意。

## 画面イメージ（プレースホルダー）

> スクリーンショット差し込み用の想定パスです（適宜差し替えてください）。
> - Overview: `media/screenshots/overview.png`
> - Repositories ツリー: `media/screenshots/repositories.png`
> - Search ビュー: `media/screenshots/search.png`
> - Preview Webview: `media/screenshots/preview.png`

## はじめ方

1. VS Code で ZennPad をインストールし、`Developer: Reload Window` を実行。
2. コマンドパレットで `ZennPad: Sign in to GitHub` を実行（Sign out は `ZennPad: Sign out of GitHub`）。
3. `zennpad.githubOwner` / `zennpad.githubRepo` を設定するか、`ZennPad: Choose GitHub Repository` で対象リポジトリを選択。
4. `ZennPad: Refresh` で GitHub から articles/images などを取得。ツリーから編集を開始。
5. 画像を貼る場合は Markdown 上でペースト/ドロップするか、`ZennPad: Insert Image from File` を使用。
6. プレビューしたいときは `zenn` CLI を PATH に入れた上で `ZennPad: Preview` を実行。

## よく使うコマンド

| コマンド                                          | 役割                                          |
|-----------------------------------------------|-----------------------------------------------|
| ZennPad: Sign in/Sign out of GitHub           | GitHub 認証の開始・解除                         |
| ZennPad: Choose GitHub Repository             | 対象リポジトリを QuickPick で選択                    |
| ZennPad: Refresh                              | GitHub から最新の articles/books/images を取得    |
| ZennPad: New Article / New Book / New Chapter | テンプレート付きで新規作成（slug/frontmatter 自動生成） |
| ZennPad: Publish Article / Unpublish Article  | frontmatter の `published` をトグル                |
| ZennPad: Preview                              | zenn CLI バックエンドで Webview プレビューを開く            |
| ZennPad: Insert Image from File               | ローカル画像を `/images` に保存し Markdown を挿入     |
| ZennPad: Deploy Pending Changes to Zenn       | work ブランチから main にデプロイ                        |
| ZennPad: Flush Pending Sync                   | 保留中の同期を強制フラッシュ                         |
| ZennPad: Pause/Resume Auto Sync               | 自動同期の一時停止/再開                        |
| ZennPad: Copy Zenn URL / Copy GitHub URL      | 選択中コンテンツのリンクをコピー                           |
| ZennPad: Sort Articles by Date/Title          | ツリー表示の並び替え切替                            |

## ビュー構成

- Repositories ビュー: Articles/Books/Drafts/Images/Files を表示し、ステータス（ドラフト/公開/未同期）やコンテキストアクションを提供。
- Search ビュー: 検索バー + 結果一覧を Webview で表示。サインイン前はようこそスライドで主要機能を案内。
- Actions ビュー: Sign in/設定/ヘルプのショートカット。Zenn プロフィール指定とアクセスもここから。

## 必要条件

- VS Code 1.85 以上
- `repo` 権限を持つ GitHub アカウント（GitHub 認証/Contents API 利用のため）
- Zenn 用リポジトリ（`articles/` `books/` `images/` 構造）
- `zenn` CLI が PATH にあること（プレビュー機能に必要）

## トラブルシュート

- 認証に失敗する: VS Code 側の GitHub セッションを確認し、`ZennPad: Sign in to GitHub` を再実行。
- プレビューが起動しない: `zenn preview` コマンドの有無と PATH を確認。ポート競合時は再実行で自動再取得。
- 画像が 404 になる: ペースト/ドロップ/`Insert Image from File` で `/images` 配下に保存されているか確認し、`Refresh` で同期を取り直す。

## 開発者向け

開発環境のセットアップやコントリビュート手順は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT](LICENSE)
