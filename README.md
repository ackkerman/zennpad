<div align="center">
    <img src="./media/logo/icon-dark.png" alt="ZennPad Logo" width="200" height="200"/>
    <h1>📘 ZennPad</h1>
    <h3><em>Zenn をより手軽に、身近に</em></h3>
</div>

<p align="center">
    <strong>VS Code のサイドバーから Zenn 記事を執筆・管理</strong>
</p>

<p align="center">
    <a href="https://github.com/ackkerman/zennpad/actions/workflows/package-extension.yml"><img src="https://github.com/ackkerman/zennpad/actions/workflows/package-extension.yml/badge.svg" alt="CI Status"/></a>
    <a href="https://github.com/ackkerman/zennpad/stargazers"><img src="https://img.shields.io/github/stars/ackkerman/zennpad?style=social" alt="GitHub stars"/></a>
    <a href="https://github.com/ackkerman/zennpad/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ackkerman/zennpad" alt="License"/></a>
    <a href="https://github.com/ackkerman/zennpad/tree/main/docs"><img src="https://img.shields.io/badge/docs-Repository-blue" alt="Documentation"/></a>
</p>

ZennPad は、VS Code のサイドバーから Zenn の記事/本/画像をまるごと扱える拡張機能です。GitHub リポジトリを仮想ファイルシステムとして開き、記事のドラフト作成・公開切替・画像挿入・プレビュー・デプロイまでをサイドバー上で行えるようにします。

<img src="https://placehold.co/600x400?text=general-gif" width="750px" />

## 🏃 Getting Started

1. VS Code で ZennPad をインストールし、`Developer: Reload Window` を実行します。
2. アクティビティバーのノートブックアイコンから `ZennPad` タブを開き、`ZennPad: Sign in to GitHub` で認証します。
3. `zennpad.githubOwner` / `zennpad.githubRepo`（必要に応じて `zennpad.workBranch`）を設定するか、`ZennPad: Choose GitHub Repository` で対象リポジトリを選択します。
4. `ZennPad: Refresh` でリポジトリ構造（articles/drafts/books/images/files）を取得し、ツリーから編集を始めます。
5. 画像を挿入する場合は Markdown に貼り付け/ドラッグ＆ドロップするか、`ZennPad: Insert Image from File` を実行します。
6. プレビューしたい場合は `zenn` CLI をインストール済みであることを確認し、`ZennPad: Preview` を実行してください。

ここからは記事/本/画像の作成・公開制御・プレビュー・デプロイ・検索まで、すべてをサイドバーとコマンドパレットから操作できます。Zenn 用コンテンツ管理のワークフローをまるごと VS Code に閉じ込めました。🙌

---

<details open>
  <summary><h2>&nbsp;✍️ 記事・本・画像管理</h2></summary>

ZennPad では Articles/Drafts/Books/Images/Files を Repositories ビューでツリー表示します。コンテキストメニューからリネーム・複製・削除、Zenn/GitHub へのリンクコピーやブラウザーオープンが可能です。

<img width="250px" src="https://placehold.co/600x400?text=Manage+articles+\n+books,+images" />

- **新規作成**: `ZennPad: New Article` は日付入り slug と frontmatter を自動生成します。Book/Chapter も同様にテンプレート付きで作成できます。
- **公開/非公開の切替**: `ZennPad: Publish Article` / `Unpublish Article` で frontmatter の `published` をトグルし、`Open on Zenn` から公開 URL をブラウザーで開けます。
- **並び替え**: ツールバーの切替で記事を日付/タイトル順に並べ替えられます。
- **リンク操作**: 任意のノードから Zenn/GitHub URL、絶対/相対パスをコピーできます。
- **ドラフト管理**: Drafts 配下のコンテンツもツリー上で同じ操作が可能です。

</details>

<details open>
  <summary><h2>&nbsp;🧑‍🤝‍🧑 リポジトリと同期</h2></summary>

ZennPad は GitHub Contents API を使ってリポジトリを仮想ファイルシステムとして扱います。ローカルに clone することなく、ブランチと同期しながら編集できます。

<img width="250px" src="https://placehold.co/600x400?text=Sync+with+repository" />

- **サインインと選択**: `ZennPad: Sign in to GitHub` で GitHub 認証し、`ZennPad: Choose GitHub Repository` で対象を選択。
- **自動同期**: `zennpad.workBranch`（デフォルト `zenn-work`）に自動で反映し、ステータスバーから一時停止/再開が可能。`ZennPad: Flush Pending Sync` で保留キューを即座にフラッシュできます。
- **デプロイ**: `Deploy to Zenn` コマンドで work ブランチから main ブランチへ反映し、Zenn 側に公開します。
- **設定パネル**: Actions ビューの Settings から owner/repo/branch/zennAccount を GUI で変更できます。

</details>

<details open>
  <summary><h2>&nbsp;🔍 Search ビュー</h2></summary>

Search ビューはファイル名/タイトル/本文を横断検索できる Webview です。ケース/単語/正規表現トグルを備え、結果から直接ファイルを開けます。サインイン前はウェルカムスライドで主要操作を案内します。

<img width="250px" src="https://placehold.co/600x400?text=Search+view" />

</details>

<details open>
  <summary><h2>&nbsp;🖼️ 画像の取り込み</h2></summary>

Markdown への貼り付けやドラッグ＆ドロップを検知し、画像を `/images/<timestamp>.<ext>` に保存して `![](/images/...)` を自動挿入します。`ZennPad: Insert Image from File` でファイル選択からの挿入も可能です。

<img width="250px" src="https://placehold.co/600x400?text=Insert+images+into+\n+article+directly" />

- **パス操作**: 画像ノードから絶対/相対パスをコピーできます。
- **ブラウザー確認**: GitHub 上の画像 URL を直接開く導線を用意しています。

</details>

<details open>
  <summary><h2>&nbsp;🛰️ プレビューとデプロイ</h2></summary>

Zenn CLI をバックエンドにした Webview プレビューを提供します。`ZennPad: Preview` を実行すると、アクティブな Markdown を同期しつつ、リバースプロキシ経由でプレビューを表示します。`/images` へのリクエストもローカルで解決されるため、ドラフト中でも正確な見た目を確認できます。

<img width="250px" src="https://placehold.co/600x400?text=Preview+and+deploy" />

- プレビューには `zenn` CLI が必要です（PATH で解決できることを確認してください）。
- ポート競合時は自動で別ポートを取得し、Webview を再起動します。

</details>

<details open>
  <summary><h2>&nbsp;🎯 Actions ビュー</h2></summary>

Actions ビューはクイックアクセスランチャーです。サインイン、設定パネル、Zenn プロフィール、ヘルプガイド（外部サイト or プレビュー deep link）への導線をまとめています。ようこそ状態では認証・設定の導線を提示し、準備完了後はヘルプやデプロイ操作に置き換わります。

<img width="250px" src="https://placehold.co/600x400?text=Action+view" />

</details>

---

<details open>
  <summary><h2>&nbsp;⏯️ Appendix: Contributed Commands</h2></summary>
  
- `ZennPad: Sign in to GitHub` / `Sign out of GitHub` - GitHub 認証の開始と解除
- `ZennPad: Choose GitHub Repository` - 対象リポジトリを Quick Pick で選択
- `ZennPad: Refresh` - GitHub から最新の articles/books/images を取得
- `ZennPad: New Article` / `New Book` / `New Chapter` - テンプレート付きで新規作成
- `ZennPad: Publish Article` / `Unpublish Article` - frontmatter の `published` をトグル
- `ZennPad: Preview` - zenn CLI バックエンドで Webview プレビューを開く
- `ZennPad: Insert Image from File` - ローカル画像を `/images` に保存し Markdown を挿入
- `ZennPad: Deploy to Zenn` - work ブランチから main ブランチへデプロイ
- `ZennPad: Flush Pending Sync` - 保留中の同期を強制フラッシュ
- `ZennPad: Pause Auto Sync` / `Resume Auto Sync` - 自動同期の一時停止/再開
- `ZennPad: Copy Zenn URL` / `Copy GitHub URL` - 選択中コンテンツのリンクをコピー
- `ZennPad: Sort Articles by Date` / `Sort Articles by Title` - 記事ツリーの並び順を切替

</details>

<details open>
  <summary><h2>&nbsp;📋 Appendix: Configuration Settings</h2></summary>

- `zennpad.githubOwner` - Zenn 用リポジトリの GitHub オーナー（ユーザーまたは org）
- `zennpad.githubRepo` - Zenn 用リポジトリ名
- `zennpad.githubBranch` - デプロイ先のメインブランチ（デフォルト: `main`）
- `zennpad.workBranch` - 編集内容を自動同期するワークブランチ（デフォルト: `zenn-work`）
- `zennpad.zennAccount` - Zenn アカウント（`zenn.dev/{username}`）。空の場合は `githubOwner` を使用

</details>

## 開発

開発環境のセットアップやコントリビュート手順は [`CONTRIBUTING.md`](./CONTRIBUTING.md) を参照してください。ビルド/テスト/フォーマット用の npm スクリプトは [`package.json`](./package.json) にまとまっています。

## ライセンス

[MIT](LICENSE)
