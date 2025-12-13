# ZennPad

ZennPad は Zenn 記事/Book を VS Code のサイドバーから操作するための拡張機能です。docs/spec.md の要件に沿った最小限のスケルトンを提供します。

## セットアップ

```bash
pnpm install
pnpm run compile
```

VS Code の `Run Extension` 構成でデバッグ起動すると、Activity Bar に ZennPad ビューが出現します。

## GitHub 認証

1. GitHub で Personal Access Token（`repo` 権限）を発行。
2. ZennPad 設定で `zennpad.githubOwner` / `zennpad.githubRepo` / `zennpad.githubBranch`（監視用 main） / `zennpad.workBranch`（通常保存用、既定は `zenn-work`）を設定。Zenn のプロフィール URL を固定したい場合は任意で `zennpad.zennAccount` も指定。
3. コマンドパレットで `ZennPad: Sign in to GitHub` を実行し、認証を完了。

## ワークフロー（work/main 分離）

- 編集/保存は work ブランチに自動コミット＆push。
- Zenn へのデプロイは `ZennPad: Deploy Pending Changes to Zenn` で work → main をマージして実行。
- 自動同期を一時停止したい場合は `ZennPad: Pause/Resume Auto Sync` を使用。

## 品質タスク

- Lint: `pnpm run lint`（ESLint + @typescript-eslint）
- Format: `pnpm run format`（Prettier）
- Test: `pnpm test`（`tsc` コンパイル + `node --test`）

GitHub Actions の `ci` ワークフローで lint/test を自動実行します。
