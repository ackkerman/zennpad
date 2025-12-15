# Implementation Plan: ZennPad VS Code拡張によるZennワークフロー統合

**Branch**: `001-zenn-vscode-extension` | **Date**: 2025-12-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-zenn-vscode-extension/spec.md`

## Summary

VS Code拡張でZennのコンテンツ（articles/books/drafts/images）をGitHubリポジトリ経由で管理・編集・プレビューし、ワークブランチとメインブランチを分離した安全な同期/デプロイと、Webviewベースの検索・オンボーディングを提供する。仮想FS→プレビュー用ミラー、リバースプロキシ経由プレビュー、デバウンス付き同期キュー、公開状態制御、画像挿入、横断検索、エラー復旧導線を統合する。

## Technical Context

**Language/Version**: TypeScript 5.x (Node 18+ runtime via VS Code extension host)  
**Primary Dependencies**: VS Code API, @octokit/rest (GitHub Contents + Git Data), get-port/http-proxy for preview, yaml/frontmatter utilities, which/zenn CLI discovery  
**Storage**: GitHubリポジトリ（remote）、VS Code globalStorage/workspaceState（キャッシュ・ミラー）、ローカルミラーFS  
**Testing**: `pnpm test` (tsc→node --test), `pnpm lint`, `pnpm format`  
**Target Platform**: VS Code ≥1.85 (desktop)  
**Project Type**: VS Code extension（単一プロジェクト、エクステンション+Webview+ローカルプロキシ）  
**Performance Goals**: プレビュー反映≤2s(95%)、検索レスポンス≤2s/500ファイル、作成/ツリー反映≤10s  
**Constraints**: メインデプロイは明示確認; 自動同期はデバウンス+キュー; Zennデプロイ上限150回/日を超えない; 画像3MB目安; オフライン編集中はローカル保持→再接続時競合解決  
**Scale/Scope**: 単一/複数Zennリポ（将来拡張）、記事/章/画像数は数百〜数千を想定、Webview UIはサイドバー複数ビュー

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Layered separation: UI/Webview, FS provider, sync/push pipeline、previewミラー/プロキシを明示分離し、依存方向を一方向に保つ計画 → **OK**。
- Sync safety: work/main分離、sha検証と409検知、デバウンス付きキュー、手動デプロイ確認を維持 → **OK**。
- VS Code UX consistency: 既存のビュー/コマンド命名とアイコンを踏襲し、破壊的操作は確認付き → **OK**。
- Testability: パス変換、キャッシュ、同期キュー、プレビュー起動/リトライをユニット/統合テスト可能な形で設計 → **OK**。
- Error handling: 401/403/404/409/429やプレビュー起動失敗の復旧導線を要求仕様に反映済み → **OK**。
- UI changes: Webview/ツリービュー更新時は `make screenshot-web` でプレビュー画像更新を計画に含める → **OK**。

## Project Structure

### Documentation (this feature)

```text
specs/001-zenn-vscode-extension/
├── plan.md          # /speckit.plan output
├── research.md      # Phase 0 research
├── data-model.md    # Phase 1 data model
├── quickstart.md    # Phase 1 onboarding
├── contracts/       # Phase 1 API/command contracts
└── tasks.md         # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── commands/        # VS Code command registrations and handlers
├── fs/              # FileSystemProvider and path mapping
├── github/          # GitHub API client, sync logic, cache
├── preview/         # preview workspace mirror, proxy/server startup
├── ui/              # Webview assets (search/actions/help) and view models
├── utils/           # shared helpers (frontmatter, path, markdown)
├── __tests__/       # unit/integration tests (node --test after tsc)
├── config.ts        # configuration schema/readers
├── context.ts       # extension context wiring
└── extension.ts     # main activation entry

docs/                # additional docs/specs
media/               # icons and screenshots
out/                 # compiled JS (tsc)
```

**Structure Decision**: 単一のVS Code拡張プロジェクト構成を採用し、レイヤ毎に `commands`/`fs`/`github`/`preview`/`ui`/`utils` を分離。testsは `src/__tests__` でtsc後にnode --test実行。

## Complexity Tracking

現時点で憲法違反となる設計は予定しておらず、追加の複雑性はなし。必要になった場合に記載する。
