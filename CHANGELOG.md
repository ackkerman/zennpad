# CHANGELOG

## v0.1.2

### 変更
- README のデモ画像を `docs/videos/demo-full.gif` に差し替えて、プロダクトの流れが分かる実演を掲載。
- パッケージバージョンを 0.1.2 に更新し、プレースホルダーをリリース用に反映。

## v0.1.1

### 追加
- GitHub サインイン完了時に githubOwner を自動補完し、リポジトリ選択を QuickPick 化（owner/repo 同期・所属リポジトリも含む）して設定フローを簡素化（src/commands/auth.ts, src/github/auth.ts, src/github/repoPicker.ts, src/ui/settings/panel.ts）。
- GitHub sync のユニットテストを追加し、リモート未存在ファイルのプルーンや Blob フォールバックをカバー（src/__tests__/githubSync.test.ts）。
- 変更差分からリリースノートを生成するスクリプトを追加（.github/workflows/scripts/generate-release-notes.sh）。
- ActionsビューをTreeView化し、Sign in / Settings / Open Zennに加えてヘルプリンクも同ビューに統合。ヘルプリンクはプレビュー経由（preview.openPath）または外部ブラウザで開くようにした（src/ui/actionsView.ts, src/ui/helpGuide.ts, package.json）。
- ActionsビューからZennユーザー名を入力して `zennpad.zennAccount` を更新し、`https://zenn.dev/{username}` を開ける導線を追加（src/ui/actionsView.ts）。
- Repositoriesツリーで任意フォルダを新規作成できる `zennpad.newFolder` を追加し、articles/books/images 以外のフォルダもツリー末尾に表示・展開できるようにした（src/commands/content.ts, src/ui/tree/zennTreeDataProvider.ts, package.json）。
- SearchビューをVS Code検索バー風のUIに刷新し、ファイル名→タイトル→本文優先で検索結果を折りたたみ表示。大文字/単語境界/正規表現トグルと多言語ラベルを実装（package.json, src/ui/searchView.ts）。
- Markdown貼り付けのPasteプロバイダーに`pasteMimeTypes`を設定し、クリップボード経由の画像でも`/images/xxx`への保存と`![](/images/xxx)`の挿入が確実に発火するようにした（src/ui/imageInsertion.ts）。
- `resolveGitHubFileBuffer`のフォールバック動作をカバーするユニットテストを追加し、GitHub同期が大きなファイルでも途切れないことを検証（src/__tests__/githubSync.test.ts）。

### 修正
- Book/Chapter の Zenn URL 生成でプレビュー/公開 URL を正しく分岐し、非 Markdown 資産は URL を作らないようにした（src/commands/openOnZenn.ts, src/__tests__/openOnZenn.test.ts）。
- GitHub pull 時に articles/books/images のディレクトリを自動生成し、リモートで削除されたエントリをローカルからもプルーンするようにした（src/github/sync.ts）。
- Searchビューで検索結果の summary をクリック/Enter/Space で開けるようにし、ダブルクリック依存を解消（src/ui/searchView.ts）。
- プレビュープロキシで `http://localhost:<port>` のヘルプリンクを動的ポートの相対パスとして扱い、zenn CLI 起動ポートが変わってもプレビューできるようにした。外部サイトは埋め込みを避け、既定ブラウザで開くよう分岐（src/preview/previewManager.ts, src/ui/helpGuide.ts）。
- クリップボード貼り付け時に画像リンクが二重挿入される問題を修正（src/ui/imageInsertion.ts）。
- GitHub Content APIが1MB超のファイルでcontentを返さないケースに備え、`git.getBlob`によるバイナリ取得へフォールバックする処理を追加し、プレビュー用の同期が画像など大きなファイルでも失敗しないようにした（src/github/fileContent.ts, src/github/sync.ts）。
- プレビュー用プロキシで`/images/*`リクエストを捕捉し、プレビュー用ミラー直下の実ファイルを静的配信するハンドラーを追加。zenn CLI経由で404になる状況でもローカル画像を確実に表示できるようにした（src/preview/previewProxyServer.ts）。
- Searchビューで未サインイン時は検索バーを隠してプロダクトツアーのみを表示し、サインイン済みでは空結果ビューを初期表示するように調整（src/ui/searchView.ts）。
- GitHubサインアウト失敗時に未処理例外にならないようガードし、サインアウト後は強制的に未ログイン状態へUI/コンテキストを更新（src/github/auth.ts, src/commands/auth.ts, src/extension.ts）。
- 設定パネル（QuickPick）のラベル・説明・トグル文言を多言語化し、英日で表示が切り替わるようにした（src/ui/settings/panel.ts）。
- 汎用ファイル・フォルダに対しても複製/削除/リネームメニューが出るようにし、複製時に拡張子を維持するよう修正（package.json, src/ui/tree/zennTreeDataProvider.ts, src/commands/content.ts）。
- VSIXに必要な out/node_modules を含めるよう .vscodeignore を追加し、配布パッケージ欠落を防止（.vscodeignore）。
- Actions統合に伴い未使用となっていたヘルプ用 TreeDataProvider を削除し、余計な VS Code 依存を解消（src/ui/helpViewProvider.ts ほか）。

### 変更
- ステータスバーにZennPadロゴSVGを用い、ライト/ダークテーマに応じたブランド表示とツールチップを追加（src/ui/statusBar.ts, media/logo）。
- コマンド表示・コンテキストキーを多言語対応で整理し、エディタタイトルに「Zennで開く」ボタンを追加するなどUI導線を改善（package.json ほか）。

## v0.0.1

- 初期リリース。
