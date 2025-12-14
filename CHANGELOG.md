# CHANGELOG

## Unreleased

### 追加
- ActionsビューをTreeView化し、Sign in / Settings / Open Zennに加えてヘルプリンクも同ビューに統合。ヘルプリンクはプレビュー経由（preview.openPath）または外部ブラウザで開くようにした（src/ui/actionsView.ts, src/ui/helpGuide.ts, package.json）。
- ActionsビューからZennユーザー名を入力して `zennpad.zennAccount` を更新し、`https://zenn.dev/{username}` を開ける導線を追加（src/ui/actionsView.ts）。
- SearchビューをVS Code検索バー風のUIに刷新し、ファイル名→タイトル→本文優先で検索結果を折りたたみ表示。大文字/単語境界/正規表現トグルと多言語ラベルを実装（package.json, src/ui/searchView.ts）。
- Markdown貼り付けのPasteプロバイダーに`pasteMimeTypes`を設定し、クリップボード経由の画像でも`/images/xxx`への保存と`![](/images/xxx)`の挿入が確実に発火するようにした（src/ui/imageInsertion.ts）。
- `resolveGitHubFileBuffer`のフォールバック動作をカバーするユニットテストを追加し、GitHub同期が大きなファイルでも途切れないことを検証（src/__tests__/githubSync.test.ts）。

### 修正
- プレビュープロキシで `http://localhost:<port>` のヘルプリンクを動的ポートの相対パスとして扱い、zenn CLI 起動ポートが変わってもプレビューできるようにした。外部サイトは埋め込みを避け、既定ブラウザで開くよう分岐（src/preview/previewManager.ts, src/ui/helpGuide.ts）。
- クリップボード貼り付け時に画像リンクが二重挿入される問題を修正（src/ui/imageInsertion.ts）。
- GitHub Content APIが1MB超のファイルでcontentを返さないケースに備え、`git.getBlob`によるバイナリ取得へフォールバックする処理を追加し、プレビュー用の同期が画像など大きなファイルでも失敗しないようにした（src/github/fileContent.ts, src/github/sync.ts）。
- プレビュー用プロキシで`/images/*`リクエストを捕捉し、プレビュー用ミラー直下の実ファイルを静的配信するハンドラーを追加。zenn CLI経由で404になる状況でもローカル画像を確実に表示できるようにした（src/preview/previewProxyServer.ts）。

### 変更
- ステータスバーにZennPadロゴSVGを用い、ライト/ダークテーマに応じたブランド表示とツールチップを追加（src/ui/statusBar.ts, media/logo）。
- コマンド表示・コンテキストキーを多言語対応で整理し、エディタタイトルに「Zennで開く」ボタンを追加するなどUI導線を改善（package.json ほか）。
