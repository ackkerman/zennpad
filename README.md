<div align="center">
    <img src="./media/extension-logo.png" alt="ZennPad Logo" width="200" height="200"/>
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

---

**Table of Contents**

- [🏃Getting Started](#getting-started)
- [✍️記事・本・画像管理](#️記事本画像管理)
- [🧑‍🤝‍🧑リポジトリと同期](#リポジトリと同期)
- [🔍Search ビュー](#search-ビュー)
- [🖼️画像の取り込み](#️画像の取り込み)
- [🛰️プレビューとデプロイ](#️プレビューとデプロイ)
- [🎯Actions ビュー](#actions-ビュー)
- [⏯️ Appendix: Contributed Commands](#️-appendix-contributed-commands)
- [📋 Appendix: Configuration Settings](#-appendix-configuration-settings)
- [開発](#開発)
- [ライセンス](#ライセンス)

---

## 🏃Getting Started

1. マーケットプレイスから ZennPad をインストールします。
2. アクティビティバーのノートブックアイコンから `ZennPad` タブを開き、`ZennPad: Sign in to GitHub` で認証します。

   <img width="250px" src="./docs/images/signin-to-github.png" />

3. `zennpad.githubOwner` / `zennpad.githubRepo`（必要に応じて `zennpad.workBranch`）を設定するか、`ZennPad: Choose GitHub Repository` で対象リポジトリを選択します。

   <img width="400px" src="./docs/images/github-config.png" />

4. `ZennPad: Refresh` でリポジトリ構造（articles/drafts/books/images/files）を取得し、ツリーから編集を始めます。

   <img width="250px" src="./docs/images/feature-refresh.png">

5. 画像を挿入する場合は Markdown に貼り付け/ドラッグ＆ドロップするか、`ZennPad: Insert Image from File` を実行します。 ([👉 画像の取り込み - ZennPad](#🖼️画像の取り込み))

6. プレビューしたい場合は `zenn` CLI をインストール済みであることを確認し、`ZennPad: Preview` を実行してください。

> [!IMPORTANT]
> 本リポジトリは、Zenn が公式に提供している **GitHub 連携機能**を前提に動作します。  
> 連携方法の詳細は、Zenn 公式ドキュメントを参照してください。  
> 関連: 👉 [アカウントにGitHubリポジトリを連携してZennのコンテンツを管理する](https://zenn.dev/zenn/articles/connect-to-github)

---

## ✍️記事・本・画像管理

ZennPad では Articles/Drafts/Books/Images/Files を Repositories ビューでツリー表示します。コンテキストメニューからリネーム・複製・削除、Zenn/GitHub へのリンクコピーやブラウザーオープンが可能です。

<img width="400px" src="./docs/images/view-repo.png" />

- **新規作成**: `ZennPad: New Article` は日付入り slug と frontmatter を自動生成します。Book/Chapter も同様にテンプレート付きで作成できます。
  
  <img width="250px" src="./docs/images/feature-create-new-article.png">

- **公開/非公開の切替**: `ZennPad: Publish Article` / `Unpublish Article` で frontmatter の `published` をトグルし、`Open on Zenn` から公開 URL をブラウザーで開けます。

  <img width="250px" src="./docs/images/feature-publish-article.png">

- **並び替え**: ツールバーの切替で記事を日付/タイトル順に並べ替えられます。
- **リンク操作**: 任意のノードから Zenn/GitHub URL、絶対/相対パスをコピーできます。
- **ドラフト管理**: Drafts 配下のコンテンツもツリー上で同じ操作が可能です。

  <img width="350px" src="./docs/images/feature-draft-1.png">

> [!TIP]
> **ドラフトはタイトルの横に鍵アイコンが表示されます**
>
> <img width="400px" src="./docs/images/feature-draft-2.png">

## 🧑‍🤝‍🧑リポジトリと同期

ZennPad は GitHub Contents API を使ってリポジトリを仮想ファイルシステムとして扱います。ローカルに clone することなく、ブランチと同期しながら編集できます。

```mermaid
flowchart LR
    A[ローカルファイル<br/>（Markdown）]
    B[GitHub Repository<br/>（Remote）]
    C[Zenn]

    A -->|auto sync| B
    B -->|auto sync| C  
```

- **サインインと選択**: `ZennPad: Sign in to GitHub` で GitHub 認証し、`ZennPad: Choose GitHub Repository` で対象を選択。
- **自動同期**: `zennpad.workBranch`（デフォルト `zenn-work`）に自動で反映し、ステータスバーから一時停止/再開が可能。`ZennPad: Flush Pending Sync` で保留キューを即座にフラッシュできます。
- **デプロイ**: `Deploy to Zenn` コマンドで work ブランチから main ブランチへ反映し、Zenn 側に公開します。
- **設定パネル**: Actions ビューの Settings から owner/repo/branch/zennAccount を GUI で変更できます。

関連: 👉 [アカウントにGitHubリポジトリを連携してZennのコンテンツを管理する(https://zenn.dev/zenn/articles/connect-to-github)](https://zenn.dev/zenn/articles/connect-to-github)

## 🔍Search ビュー

Search ビューはファイル名/タイトル/本文を横断検索できる Webview です。ケース/単語/正規表現トグルを備え、結果から直接ファイルを開けます。

<img width="400px" src="./docs/images/view-search.png" />

**検索結果**

<img width="300px" src="./docs/images/feature-search-results.png" />

## 🖼️画像の取り込み

Markdown への貼り付けやドラッグ＆ドロップを検知し、画像を `/images/<timestamp>.<ext>` に保存して `![](/images/...)` を自動挿入します。`ZennPad: Insert Image from File` でファイル選択からの挿入も可能です。

<img width="400px" src="./docs/images/feature-insert-image-from-context.png" />

- **挿入方法**:
  - ショートカットキー: `Ctrl+V`
  - コマンド: `ZennPad: Insert Image from File`
  - コンテキストウィンドウ: `Insert Image from File`
- **パス操作**: Zennの画像ファイル配置ルールに従い、画像が配置され、自動的に適したパスが入力されます。

> [!IMPORTANT]
> 
> **画像ファイルはリポジトリ直下の /images ディレクトリに配置します。**
> 
> 関連: 👉 [GitHubリポジトリ連携で画像をアップロードする方法](https://zenn.dev/zenn/articles/deploy-github-images)
> 
> <img width="400px" src="./docs/images/markdown-editor-1.png">

## 🛰️プレビューとデプロイ

`ZennPad: Preview` を実行すると、アクティブな Markdown を同期しつつ、プレビューを表示します。`/images` へのリクエストもローカルで解決されるため、ドラフト中でも正確な見た目を確認できます。

<img width="250px" src="./docs/images/feature-deploy.png" />

> [!TIP]
> **Zennからデプロイ状況を確認する** ([デプロイ履歴 - zenn.dev](https://zenn.dev/dashboard/deploys?deployments_history))
>
> 1. デプロイ中
>
>    <img width="600px" src="./docs/images/zenn-deploy-status.png" />
>
> 2. デプロイ成功
>
>    <img width="300px" src="./docs/images/zenn-deploy-status-success.png" />
>
> 関連: 👉 [GitHubリポジトリ連携についてのFAQ(https://zenn.dev/zenn/articles/connect-to-github)](https://zenn.dev/zenn/articles/connect-to-github#github%E3%83%AA%E3%83%9D%E3%82%B8%E3%83%88%E3%83%AA%E9%80%A3%E6%90%BA%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6%E3%81%AEfaq)

## 🎯Actions ビュー

Actions ビューはクイックアクセスランチャーです。サインイン、設定パネル、Zenn プロフィール、ヘルプガイド（外部サイト or プレビュー deep link）への導線をまとめています。

<img width="400px" src="./docs/images/view-actions.png" />

---

## ⏯️ Appendix: Contributed Commands
  
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

## 📋 Appendix: Configuration Settings

- `zennpad.githubOwner` - Zenn 用リポジトリの GitHub オーナー（ユーザーまたは org）
- `zennpad.githubRepo` - Zenn 用リポジトリ名
- `zennpad.githubBranch` - デプロイ先のメインブランチ（デフォルト: `main`）
- `zennpad.workBranch` - 編集内容を自動同期するワークブランチ（デフォルト: `zenn-work`）
- `zennpad.zennAccount` - Zenn アカウント（`zenn.dev/{username}`）。空の場合は `githubOwner` を使用

## 開発

開発環境のセットアップやコントリビュート手順は [`CONTRIBUTING.md`](./CONTRIBUTING.md) を参照してください。ビルド/テスト/フォーマット用の npm スクリプトは [`package.json`](./package.json) にまとまっています。

## ライセンス

[MIT](LICENSE)
