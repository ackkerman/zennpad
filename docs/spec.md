# ZennPad spec.md

Zenn の執筆フローを「VS Code 常駐」に寄せるための拡張機能。
UI/UX は GistPad を参考にしつつ、永続化は GitHub リポジトリ、公開・反映先は Zenn とする。

---

## 目的

- Zenn 記事/Book を **VS Code のサイドバーから素早く開いて編集**できるようにする
- git clone / push / PR といった Git 運用をユーザーから隠蔽し、**ローカルファイルのように編集**できる体験を提供する
- 「思考を止めない」執筆 UX（Tree + 仮想FS + コマンド）を実現する

---

## 前提

### アーキテクチャ

- 永続化先
  - GitHub Repository
    - 例: `ackkerman/ackkerman-zenn`
- データ実体（Zenn のリポジトリ構造）
  - `articles/*.md`
  - `books/*/*.md`
- 編集手段
  - GitHub API
    - Contents API（必須）
    - Git Data API（必要に応じて採用）
- 認証
  - GitHub Personal Access Token（PAT）
  - 必要スコープ: `repo:contents`（最小）
- Zenn への反映
  - GitHub Repo 更新 → Zenn 側が自動同期（前提）

### UI / UX

- GistPad 風の UX（サイドバーの Tree、コマンドパレット中心）
- ワンクリックで「今日の下書き」を作成できる
- タイトル未確定でも書き始められる
- 後から Article / Book へ昇格・整理できる

### 編集対象

- Zenn Article
- Zenn Book / Chapter
- 下書き / 公開済みコンテンツ

---

## 全体像（GistPad ライク構成）

```

VS Code Extension
├─ Activity Bar（Zenn アイコン）
│  └─ Zenn Tree View
│      ├─ Articles
│      ├─ Books
│      │   └─ Chapters
│      └─ Drafts / Daily
│
├─ Virtual File System (read/write)
│  └─ GitHub Repository (ackkerman-zenn)
│
├─ Commands (Command Palette)
│  ├─ New Article
│  ├─ Publish / Unpublish
│  ├─ Open on Zenn
│  └─ Refresh
│
└─ Auth / Storage
└─ GitHub Token (VS Code SecretStorage)

```

三本柱: **Tree + 仮想FS + コマンド**

---

## 機能要件

### 1. サイドバー常駐型コンテンツナビゲーション

- Zenn の記事・Book を Tree 表示で一覧できる
- 状態が一目で分かる
  - 下書き / 公開済み
  - Article / Book / Chapter
- 最近編集したものが上に来る（LRU）

#### Tree 表示（論理分類）

- Articles
  - `articles/*.md`
- Books
  - `books/*`（Book root）
  - `books/*/*.md`（Chapter）
- Drafts / Daily（論理ノード）
  - 実体は `articles/` 配下に生成（例: `articles/YYYYMMDD_daily-*.md`）

---

### 2. VS Code 拡張での CRUD 操作

- 新規記事作成
- 下書き保存
- 公開 / 非公開切り替え（frontmatter 更新）
- 削除（GitHub 上のファイル削除）
- リスト更新（Refresh）

#### 新規 Article 作成ルール

- ファイルパス: `articles/yyyyMMdd_slug.md`
- 生成直後は `published: false` をデフォルト
- slug は自動生成（タイトル未確定でも生成可能）
  - 例: `draft-<shortid>` / `daily-<shortid>`

---

### 3. ローカルライクな編集（非 clone）

- Zenn の記事をローカルファイルのように編集できる
- 保存時に GitHub 上の該当ファイルへ反映（commit まで自動）
- git clone / commit / push をユーザーに意識させない

---

### 4. 仮想ファイルシステム（FileSystemProvider）

- スキーム: `zenn:`
- URI 例:
  - `zenn:/articles/20240101_my-article.md`

- `FileSystemProvider` を実装し、編集内容の read/write を GitHub API と同期する

#### GitHub API の基本方針

- 読み込み: Contents API
  - `GET /repos/:owner/:repo/contents/:path`
- 書き込み: Contents API（コミット生成）
  - `PUT /repos/:owner/:repo/contents/:path`
- 削除:
  - `DELETE /repos/:owner/:repo/contents/:path`

---

### 5. Frontmatter / サイドパネル編集

以下を **フロントマター or サイドパネル**で即編集できること。

- タイトル（title）
- Topics（topics）
- Emoji（emoji）
- 公開状態（published）
- Book / Chapter 紐付け（必要なら導線を用意）

#### Frontmatter 生成・更新

- 保存時に frontmatter を自動的に維持/更新する
- 例:

```md
---
title: "タイトル"
emoji: "📝"
topics: ["zenn", "vscode"]
published: false
---

本文…
```

UI は段階導入:

- Phase 1: QuickPick / InputBox で編集
- Phase 2: Webview（Inspector パネル）で編集体験を改善

---

### 6. Markdown プレビュー（Zenn 互換）

- Markdown プレビュー（Zenn レンダリング互換）を提供する
- 保存 → 数秒で Zenn 上に反映される前提のため、公開後 URL への即ジャンプ導線を用意する

---

### 7. 知識ストックとしての再利用導線

- 記事断片をスニペット的に保存できる（任意機能）
- 過去記事からコピペしやすい UX（検索・最近使った）
- Book 化を前提とした再構成がしやすい

---

### 8. 差分管理・競合検知

- 保存前に現行の `sha` を保持する
- 更新時に競合（409）を検知する
- 競合時の UX:
  - ローカル差分を退避（ローカルファイル/一時領域）
  - 手動マージを促す（diff 表示 or 競合解消手順の提示）

---

## コマンド要件（Command Palette / Context Menu）

最低限:

- `Zenn: New Article`
- `Zenn: Publish Article`
- `Zenn: Unpublish Article`
- `Zenn: Open on Zenn`
- `Zenn: Refresh`

要件:

- Tree 右クリック（Context Menu）と Command Palette の両方から実行可能
- 実行結果は通知（成功/失敗/競合）で明確化

---

## 設定要件（Settings）

- GitHub Owner / Repo
  - 例: `ackkerman/ackkerman-zenn`

- Branch（デフォルト: `main`）
- Sync on Save（on/off）
- Auto Save（VS Code の autosave との干渉を避けるため、拡張側でも制御可能にする）
- Daily Draft の命名規則（任意）

---

## 認証要件（Security / Token）

- PAT は VS Code SecretStorage に保存する
  - `context.secrets.store("zennpad.githubToken", token)`

- トークン入力は初回または再認証時に促す
- 最小スコープで運用する（`repo:contents`）
- トークンをログに出さない（マスク徹底）

---

## 非機能要件

- Zenn API / 非公式 API / scraping は使用しない（本拡張の責務外）
  - 反映は GitHub Repo → Zenn 自動同期を前提とする

- 認証トークンの安全な管理（SecretStorage）
- オフライン時の一時保存（Draft）
  - GitHub への書き込み失敗時、編集内容を失わない

- レート制限対応
  - 取得結果のキャッシュ
  - Tree 更新頻度の制御（手動 refresh を基本）

---

## 実装メモ（最小構成の骨格）

### `package.json`（最低限）

```json
{
  "activationEvents": ["*"],
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "zenn",
          "title": "Zenn",
          "icon": "media/logo-only-white.svg"
        }
      ]
    },
    "views": {
      "zenn": [
        {
          "id": "zennPadExplorer",
          "name": "Zenn"
        }
      ]
    },
    "commands": [
      { "command": "zennpad.newArticle", "title": "Zenn: New Article" },
      { "command": "zennpad.publish", "title": "Zenn: Publish Article" },
      { "command": "zennpad.unpublish", "title": "Zenn: Unpublish Article" },
      { "command": "zennpad.openOnZenn", "title": "Zenn: Open on Zenn" },
      { "command": "zennpad.refresh", "title": "Zenn: Refresh" }
    ]
  }
}
```

### FileSystemProvider 登録（スケルトン）

```ts
vscode.workspace.registerFileSystemProvider("zenn", new ZennFsProvider(), {
  isCaseSensitive: true
});
```

### 保存時の GitHub 更新（Contents API）

```ts
await octokit.repos.createOrUpdateFileContents({
  owner,
  repo,
  path,
  message: `Update ${path}`,
  content: Buffer.from(text).toString("base64"),
  sha
});
```

---

## マイルストーン（提案）

- M1: 認証 + Tree 表示（articles/books の一覧）
- M2: 仮想FS read/write（開く・保存する）
- M3: New Article / Publish / Unpublish / Delete
- M4: 競合検知（409）と退避
- M5: Zenn 互換プレビュー / Open on Zenn
- M6: Daily Draft / LRU / 検索・フィルタ
