# Tasks: ZennPad VS Code拡張によるZennワークフロー統合

**Input**: Design documents from `/specs/001-zenn-vscode-extension/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 各ユーザーストーリーに最低限のユニット/統合テストを含める（憲法のテスト性要求に準拠）。

**Constitution Alignment**: GitHub syncの安全性（work/main分離・確認・デバウンス）、決定論的コア（sync/caching/path resolution）のテスト、VS Code UX準拠、auth/rate-limit/preview障害からの復旧導線を各フェーズで担保する。

**Organization**: ユーザーストーリー単位でタスクを独立実行・検証可能に構成。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可（依存なし/別ファイル）
- **[Story]**: US1/US2/US3/US4 のいずれか（セットアップ/基盤/ポリッシュは不要）
- すべてのパスは絶対パスで記述

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 既存リポの開発環境を即時起動できる状態にする

- [x] T001 `/home/ackkerman/repos/zennpad/package.json` に基づき `pnpm install` で依存を取得する
- [x] T002 [P] `pnpm lint && pnpm test && pnpm compile` を実行し現状のビルド/テスト健全性を確認する（/home/ackkerman/repos/zennpad）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ストーリー共通の基盤（認証・同期・プレビュー）を安定化

- [ ] T004 `/home/ackkerman/repos/zennpad/src/github/auth.ts` `/home/ackkerman/repos/zennpad/src/github/repoConfig.ts` でブラウザ/PATサインイン・SecretStorage保存・サインアウト・トークン失効時の復旧を網羅する
- [x] T005 [P] `/home/ackkerman/repos/zennpad/src/github/sync.ts` `/home/ackkerman/repos/zennpad/src/github/syncScheduler.ts` `/home/ackkerman/repos/zennpad/src/github/pendingState.ts` でwork/main分離・sha検証・デバウンス/キュー・手動デプロイ確認を統一する
- [x] T006 [P] `/home/ackkerman/repos/zennpad/src/fs/zennFsProvider.ts` と関連パスユーティリティで仮想パス↔GitHubパス変換、キャッシュ/sha連携、競合時の安全な読み書きを整理する
- [x] T007 [P] `/home/ackkerman/repos/zennpad/src/preview/previewWorkspace.ts` `/home/ackkerman/repos/zennpad/src/preview/previewManager.ts` `/home/ackkerman/repos/zennpad/src/preview/previewProxyServer.ts` でミラー同期・ポート確保・起動リトライ・フォールバック表示を実装する
- [x] T008 [P] `/home/ackkerman/repos/zennpad/src/ui/statusBar.ts` `/home/ackkerman/repos/zennpad/src/commands/sync.ts` に同期/デプロイ/プレビュー状態とエラー通知（401/403/404/409/429/タイムアウト）の一元表示を追加する

**Checkpoint**: 認証・同期・プレビュー基盤が安定し、各ストーリーを開始可能

---

## Phase 3: User Story 1 - リポ接続と安全な編集/プレビュー (Priority: P1) 🎯 MVP

**Goal**: GitHubリポを開いて記事を編集し、プレビューが即時反映されることを保証する

**Independent Test**: サインイン済みで記事を開き保存→プレビューが2秒以内に更新され、メインブランチへのデプロイが発生しない

### Implementation for User Story 1

- [x] T009 [P] [US1] `/home/ackkerman/repos/zennpad/src/ui/tree/zennTreeDataProvider.ts` `/home/ackkerman/repos/zennpad/src/ui/tree/frontmatterIO.ts` でツリー読み込み・frontmatter I/O・エディターオープン（zenn:スキーム）の正確性を確認/補強する
- [x] T010 [P] [US1] `/home/ackkerman/repos/zennpad/src/github/fileContent.ts` `/home/ackkerman/repos/zennpad/src/github/sync.ts` でMarkdown/Book/Chapter/Draftのreadパスをsha/キャッシュと整合させる
- [x] T011 [P] [US1] `/home/ackkerman/repos/zennpad/src/preview/previewManager.ts` `/home/ackkerman/repos/zennpad/src/preview/previewView.ts` でプレビュー起動とエントリパス設定（change_pathメッセージ含む）を安定化する
- [x] T012 [US1] `/home/ackkerman/repos/zennpad/src/preview/previewWorkspace.ts` で保存フック→ミラー同期→CLI監視による自動リロードを保証し、メインブランチデプロイを抑止する
- [x] T013 [P] [US1] `/home/ackkerman/repos/zennpad/src/__tests__/preview.test.ts` にプレビューURLマッピングと保存後リロードのユニット/軽量統合テストを追加する

**Checkpoint**: ユーザーは編集＋プレビューを安全に実行でき、mainへの誤デプロイは防止される

---

## Phase 4: User Story 2 - 新規コンテンツ作成と公開状態管理 (Priority: P1)

**Goal**: テンプレ付きで新規Article/Book/Chapter/Draftを作成し、公開/非公開を切り替えZenn/GitHubリンクを適切に扱う

**Independent Test**: タイトル入力のみで新規記事が生成されツリーに即反映、Publish/Unpublishでfrontmatterとリンク先が切り替わる

### Implementation for User Story 2

- [x] T014 [P] [US2] `/home/ackkerman/repos/zennpad/src/commands/content.ts` で新規Article/Book/Chapter/Draft作成（テンプレ・unique slug・emoji/topic初期値）を実装/補強する
- [x] T015 [P] [US2] `/home/ackkerman/repos/zennpad/src/ui/tree/frontmatterIO.ts` `/home/ackkerman/repos/zennpad/src/utils` 配下でfrontmatterシリアライズのpublished/emoji/topic初期化とバリデーションを統一する
- [x] T016 [US2] `/home/ackkerman/repos/zennpad/src/commands/content.ts` `/home/ackkerman/repos/zennpad/src/commands/openOnZenn.ts` でPublish/UnpublishとZenn/GitHub URL生成を公開状態に応じて切り替える
- [x] T017 [US2] `/home/ackkerman/repos/zennpad/src/ui/tree/zennTreeDataProvider.ts` `/home/ackkerman/repos/zennpad/src/ui/statusBar.ts` で公開状態とターゲットブランチ表示を即時反映する
- [x] T018 [P] [US2] `/home/ackkerman/repos/zennpad/src/__tests__/content.test.ts` に新規作成とPublish/Unpublishのfrontmatter変化を検証するテストを追加する

**Checkpoint**: 新規コンテンツ作成と公開状態管理が独立に検証可能

---

## Phase 5: User Story 3 - 画像挿入と同期制御 (Priority: P2)

**Goal**: 画像貼り付け/ドロップ/ファイル選択で `/images` に保存しMarkdownリンクを自動挿入、同期キューでデプロイ回数を抑制

**Independent Test**: 画像貼り付けでリンクが挿入され、同期一時停止中はキューに留まり手動デプロイ時のみmainへ反映される

### Implementation for User Story 3

- [ ] T019 [P] [US3] `/home/ackkerman/repos/zennpad/src/ui/imageInsertion.ts` で貼り付け/ドロップ/ファイル選択処理に3MB上限・MIMEフィルタ・重複リネームを実装する
- [ ] T020 [P] [US3] `/home/ackkerman/repos/zennpad/src/ui/imageInsertion.ts` `/home/ackkerman/repos/zennpad/src/fs/zennFsProvider.ts` で `/images/<name>` 保存とMarkdownリンク自動挿入を保証する
- [ ] T021 [US3] `/home/ackkerman/repos/zennpad/src/github/sync.ts` `/home/ackkerman/repos/zennpad/src/github/syncScheduler.ts` で画像変更をdirtyキューに統合し、デバウンス/手動フラッシュ/DeployToZenn時のみmain反映にする
- [ ] T022 [P] [US3] `/home/ackkerman/repos/zennpad/src/__tests__/imageInsertion.test.ts` に3MB超スキップ・リンク生成・重複リネームのテストを追加する

**Checkpoint**: 画像挿入と同期制御が独立に検証可能

---

## Phase 6: User Story 4 - 横断検索とコンフリクト復旧 (Priority: P3)

**Goal**: ファイル名/タイトル/本文の横断検索と、GitHub 409/429等のエラーからの復旧導線を提供

**Independent Test**: 検索トグルで結果が変化し、409/429発生時に通知→再試行/再取得で復旧できる

### Implementation for User Story 4

- [ ] T023 [P] [US4] `/home/ackkerman/repos/zennpad/src/ui/searchView.ts` でAa/単語/正規表現トグル付きの優先度スコアリングと結果ナビゲーションを実装/改善する
- [ ] T024 [US4] `/home/ackkerman/repos/zennpad/src/ui/searchView.ts` `/home/ackkerman/repos/zennpad/src/github/fileContent.ts` でキャッシュ優先→ライブフェッチの検索データ取得とエラー時のフォールバックを整備する
- [ ] T025 [US4] `/home/ackkerman/repos/zennpad/src/github/sync.ts` `/home/ackkerman/repos/zennpad/src/commands/sync.ts` に409/429/タイムアウト時のバックオフ・再取得・手動リトライ導線を追加する
- [ ] T026 [P] [US4] `/home/ackkerman/repos/zennpad/src/__tests__/searchView.test.ts` に検索トグルと結果ジャンプのテストを追加する

**Checkpoint**: 検索とエラー復旧が独立に検証可能

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 仕上げと全体品質向上

- [ ] T027 [P] `/home/ackkerman/repos/zennpad/specs/001-zenn-vscode-extension/quickstart.md` `/home/ackkerman/repos/zennpad/README.md` を最新のフロー・成功指標・UI手順で更新する
- [ ] T028 [P] `make screenshot-web` を実行し生成物（/home/ackkerman/repos/zennpad/media/ 以下）を確認・更新する
- [ ] T029 [P] `/home/ackkerman/repos/zennpad` で `pnpm lint && pnpm test && pnpm compile` を再実行し最終確認する
- [ ] T030 `/home/ackkerman/repos/zennpad` で不要ログ/コメント/重複コードを整理し変更セットを最終レビュー可能な状態に整える

---

## Phase 8: Books機能拡張

**Purpose**: books/* 構造の管理・作成・公開・プレビューを実装する

- [ ] T031 `/home/ackkerman/repos/zennpad/src/ui/tree/zennTreeDataProvider.ts` `/home/ackkerman/repos/zennpad/src/ui/tree/treeUtils.ts` で GitHub の books/* から Book/Chapter ツリーを構築しfrontmatter読込/ソートを実装する
- [ ] T032 [P] `/home/ackkerman/repos/zennpad/src/commands/content.ts` に Book/Chapter 作成（slug生成、frontmatter初期値、章テンプレート）を追加する
- [ ] T033 `/home/ackkerman/repos/zennpad/src/commands/content.ts` `/home/ackkerman/repos/zennpad/src/github/sync.ts` で Book/Chapter の rename/move/delete とリンク整合性/衝突ハンドリングを実装する
- [ ] T034 `/home/ackkerman/repos/zennpad/src/commands/openOnZenn.ts` `/home/ackkerman/repos/zennpad/src/ui/tree/frontmatterIO.ts` で Book の published/非公開管理と Open on Zenn (book URL) 生成を実装する
- [ ] T035 [P] `/home/ackkerman/repos/zennpad/src/preview/previewManager.ts` `/home/ackkerman/repos/zennpad/src/utils/path.ts` で Book/Chapter の preview パス解決（urlPath生成）を追加する
- [ ] T036 [P] `/home/ackkerman/repos/zennpad/src/__tests__/books.test.ts` に Book/Chapter のCRUD/公開/プレビュー/競合復旧のテストを追加する

---

## Phase 9: 複数リポジトリ接続

**Purpose**: 2つまでのZennリポを登録し、アクティブ切替でSync対象を変更する

- [ ] T037 `/home/ackkerman/repos/zennpad/src/ui/tree/zennTreeDataProvider.ts` `/home/ackkerman/repos/zennpad/src/ui/actionsView.ts` に複数リポの一覧表示と選択UI（既存Repositoriesビュー改名含む）を追加する
- [ ] T038 [P] `/home/ackkerman/repos/zennpad/src/context.ts` `/home/ackkerman/repos/zennpad/src/github/repoConfig.ts` `/home/ackkerman/repos/zennpad/src/github/sync.ts` でアクティブリポ切替に伴うFS/キャッシュ/同期ターゲット更新を実装する
- [ ] T039 [P] `/home/ackkerman/repos/zennpad/src/__tests__/multiRepo.test.ts` にリポ切替でツリー/同期/プレビューが正しく切り替わることを検証する

---

## Phase 10: Deploy制御（回数表示・計測）

**Purpose**: Zenn 150回/日上限に対する消費回数を計測・表示する

- [ ] T040 `/home/ackkerman/repos/zennpad/src/github/syncScheduler.ts` `/home/ackkerman/repos/zennpad/src/github/pendingState.ts` で Zennアカウントごとのデプロイ回数計測・永続化を実装する
- [ ] T041 [P] `/home/ackkerman/repos/zennpad/src/ui/statusBar.ts` `/home/ackkerman/repos/zennpad/src/ui/actionsView.ts` にデプロイ残回数/警告表示を追加し、上限超過時はブロックする
- [ ] T042 [P] `/home/ackkerman/repos/zennpad/src/__tests__/deployCounter.test.ts` にデプロイ回数計測と警告/ブロックのテストを追加する

---

## Phase 11: 執筆日付関連機能（ストリーク/カレンダー/草）

- [ ] T043 `/home/ackkerman/repos/zennpad/src/utils` `/home/ackkerman/repos/zennpad/src/ui` で投稿ストリーク/カレンダービュー/草マップ用の日付データ生成（コミット履歴またはfrontmatterから）を追加する
- [ ] T044 [P] `/home/ackkerman/repos/zennpad/src/ui/searchView.ts` または専用ビューにストリーク/カレンダー/草マップ表示を実装し、ソート/フィルタと連動させる
- [ ] T045 [P] `/home/ackkerman/repos/zennpad/src/__tests__/streakCalendar.test.ts` に日付集計と表示ロジックのテストを追加する

---

## Phase 12: GitHub同期キャッシュ失効とフォールバック

- [ ] T046 `/home/ackkerman/repos/zennpad/src/github/sync.ts` `/home/ackkerman/repos/zennpad/src/github/pendingState.ts` で cache.json のバージョン管理と失効ポリシー（例:10分）を実装する
- [ ] T047 [P] `/home/ackkerman/repos/zennpad/src/github/sync.ts` にパース失敗/不整合検知時のキャッシュ破棄→ライブ取得フォールバックを追加する
- [ ] T048 [P] `/home/ackkerman/repos/zennpad/src/__tests__/cachePolicy.test.ts` に失効・バージョン不一致・パース失敗時の挙動を検証する

---

## Phase 13: スニペット/断片保存と検索（任意）

- [ ] T049 `/home/ackkerman/repos/zennpad/src/ui/searchView.ts` `/home/ackkerman/repos/zennpad/src/ui/actionsView.ts` にスニペット保存/一覧/検索UIを追加する（ローカル保存で始める）
- [ ] T050 [P] `/home/ackkerman/repos/zennpad/src/utils` `/home/ackkerman/repos/zennpad/src/github` でスニペット保存先（ローカルもしくは専用フォルダ）と検索インデックスを実装する
- [ ] T051 [P] `/home/ackkerman/repos/zennpad/src/__tests__/snippets.test.ts` にスニペット保存・検索のテストを追加する

---

## Phase 14: Scrap対応の検討

- [ ] T052 `/home/ackkerman/repos/zennpad/docs/scrap-support.md` に Scrap のGitHub配置可否と拡張で扱う範囲を調査・方針決定を記述する
- [ ] T053 [P] `/home/ackkerman/repos/zennpad/src/ui/actionsView.ts` `/home/ackkerman/repos/zennpad/src/commands` で決定した方針に基づきScrap機能の導線（未対応ならガイダンス表示）を実装する

---

## Dependencies & Execution Order

Phase 1 → Phase 2 → User Stories (US1 P1, US2 P1, US3 P2, US4 P3) → Phase 7 → Phase 8 (Books) → Phase 9 (複数リポ) → Phase 10 (Deploy計測) → Phase 11 (日付可視化) → Phase 12 (キャッシュ失効) → Phase 13 (スニペット) → Phase 14 (Scrap方針)
- US1はプレビュー/編集基盤を提供するため最優先。US2はUS1の土台を前提に並行可。US3は同期基盤後に並行可。US4はツリー/キャッシュ/同期が揃った後。
- Phase 8以降は拡張機能群であり、Books→複数リポ→デプロイ計測→日付可視化→キャッシュ失効→スニペット→Scrap検討の順で進める。

### Parallel Opportunities

- Phase 1: T002, T003はT001後並列可
- Phase 2: T005/T006/T007/T008は認証基盤T004完了後に並列可
- US1: T009/T010/T011は並列可、T012は同期/preview前提で最後、テストT013は実装後
- US2: T014/T015は並列可、T016→T017の順、テストT018は後追い
- US3: T019/T020は並列可、T021は同期基盤前提、テストT022は後追い
- US4: T023とT024は並列可、T025は同期エラーハンドリング前提、テストT026は後追い
- Phase 7: T027/T028/T029はほぼ並列、T030は最終まとめ
- Phase 8: T031/T032/T035/T036は並列可、T033/T034はツリー/コマンド前提
- Phase 9: T037/T038並列可、T039は後追い
- Phase 10: T040実装後にT041並列可、T042は後追い
- Phase 11: T043/T044並列可、T045は後追い
- Phase 12: T046後にT047/T048並列可
- Phase 13: T049/T050並列可、T051は後追い
- Phase 14: T052後にT053

### Suggested MVP Scope

- MVPはUS1完了時点（編集＋プレビューが安全に動作しmainを汚さない状態）。US2以降は段階的に追加。
