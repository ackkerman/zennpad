# CHANGELOG

## Unreleased

### 追加
- Markdown貼り付けのPasteプロバイダーに`pasteMimeTypes`を設定し、クリップボード経由の画像でも`/images/xxx`への保存と`![](/images/xxx)`の挿入が確実に発火するようにした（src/ui/imageInsertion.ts）。
- `resolveGitHubFileBuffer`のフォールバック動作をカバーするユニットテストを追加し、GitHub同期が大きなファイルでも途切れないことを検証（src/__tests__/githubSync.test.ts）。

### 修正
- GitHub Content APIが1MB超のファイルでcontentを返さないケースに備え、`git.getBlob`によるバイナリ取得へフォールバックする処理を追加し、プレビュー用の同期が画像など大きなファイルでも失敗しないようにした（src/github/fileContent.ts, src/github/sync.ts）。
- プレビュー用プロキシで`/images/*`リクエストを捕捉し、プレビュー用ミラー直下の実ファイルを静的配信するハンドラーを追加。zenn CLI経由で404になる状況でもローカル画像を確実に表示できるようにした（src/preview/previewProxyServer.ts）。
