# PLANS

## 目的

ZennPad VS Code 拡張を docs/spec.md の要件に沿って実装するための全タスクを洗い出し、進捗を管理する。

## TODOリスト（チェックボックス）

- [x] Scaffold 準備
  - [x] VS Code 拡張のマニフェスト初期化（名前・displayName・publisher・アイコン設定）
  - [x] Activity Bar 用ビューコンテナー `zennPad` とツリービュー `zennPadExplorer` の登録
  - [x] コマンドプレースホルダー登録（New/Publish/Unpublish/Open/Refresh）
  - [x] TypeScript ビルド環境とスクリプト（compile/watch/test）整備
  - [x] 仮想ファイルシステム `zenn` スキームの FileSystemProvider 仮実装
  - [x] TreeDataProvider のスケルトン実装（Articles/Books/Drafts のダミーデータ）
  - [x] VS Code 開発用の launch/tasks/settings/extensions 設定追加

- [x] 拡張機能コア機能
  - [x] Articles/Books/Drafts以下のファイルをクリックしたらエディターで開く実装
  - [x] Articles/Books/Drafts の Markdown ファイル読み込み・表示実装
  - [x] Frontmatter パース・シリアライズロジック実装

- [x] Github連携
  - [x] GitHub 認証（ブラウザ起動）
  - [x] GitHub Contents API との read/write/delete 実装（sha 管理・競合検知）
  - [x] 仮想FSと実ストレージの同期（URI → GitHub パス変換、pull/push）
  - [x] Contents API が1MB超で返さない場合に git.getBlob をフォールバックする同期とユニットテスト
  - [ ] TreeDataProvider を GitHub 上の articles/books 構造から生成（LRU/ステータス表示）
  - [ ] PAT認証にも対応すること（SecretStorage で PAT 保存/読み出しにより認証できるように）
  - [x] [High Priority] Signoutを実装
  - [ ] Scrap対応？そもそもScrapはGithubに置かれないから編集できない？

- [x] コマンド実装
  - [x] 新規 Article/Book/Chapter 作成ロジック（slug 自動生成、日付ドラフト命名）
  - [x] Frontmatter 生成・更新ロジック（title/emoji/type/topics/published）
  - [x] Publish/Unpublish コマンドで frontmatter の published 切替
  - [x] Open on Zenn コマンドでブラウザ遷移（公開/下書き URL 判定）
  - [x] 競合時のハンドリング（409 時のメッセージと再取得導線）
  - [x] Markdown プレビュー（Zenn 互換レンダラー/導線）

- [x] プレビュー機能移植（zenn preview + proxy + Webview）
  - [x] ミラー同期レイヤー実装
    - [x] PreviewWorkspace サービスの骨格
    - [x] globalStorageUri 配下に preview-workspace を作成
    - [x] 初回全量同期（仮想 FS → 実ディレクトリ）
    - [x] ファイル保存時に差分同期（onDidSaveTextDocument）
    - [x] （可能なら）FileSystemProvider の writeFile/delete/rename hook で差分同期
    - [x] zenn CLI 未インストール時のエラーメッセージ/導線追加

  - [x] URI ↔ 相対パスマッピング
    - [x] 仮想スキーム (zenn:) から相対 Zenn パス (articles/foo.md, books/bar/...) への変換関数
    - [x] URL パス決定ロジック（.md, config.yaml 処理）は既存の挙動に倣う

  - [x] バックエンド起動ロジック
    - [x] get-port で backendPort（zenn preview） と proxyPort（リバースプロキシ）確保
    - [x] zenn CLI をミラーのルートで spawn（zenn preview --port backendPort）
    - [x] zenn preview 側が立ち上がるまで待機

  - [x] リバースプロキシサーバ
    - [x] /__vscode_zenn_editor_preview_proxy_index/* で踏み台 HTML + control JS を配信
    - [x] それ以外を zenn preview サーバへ透過 proxy
    - [x] control JS（proxyView.js 相当）をバンドル & 配信
    - [x] Webview iframe 側で postMessage ハンドラを用意

  - [x] Webview 側制御
    - [x] WebviewPanel 作成（enableScripts: true）
    - [x] iframe を entrypoint URL で初期ロード
    - [x] extension → Webview への postMessage（change_path）
    - [x] Webview 内 control JS → iframe の src 書き換え実装

  - [x] ファイル変更と自動リロード
    - [x] 保存時にミラー同期 → zenn CLI がファイル監視してるため自動リロード
    - [x] Webview iframe 内でのリロード処理（VL：iframe に対してセマンティックな reload）
  - [x] 仮想FS経由で取得した images/ 配下の実体を preview ミラーに同期し、`/images/<name>` リクエストで 404 が出ないように配信/検証する

- [ ] 作りこみ（Phase 2 以降）
  - [ ] スニペット/断片保存と検索（任意機能）
  - [ ] Book/Chapter 紐付け UI（Phase 1: QuickPick/InputBox、Phase 2: Webview Inspector）

- [x] リファクタリング
  - [x] [HIGH PRIORITY] コード整理（サービス分割、責務分離、命名見直し）
    - [x] 構造の例は[参考用のディレクトリ構造](#参考用のディレクトリ構造)　を参照せよ
    - [x] commands分割：registerCommands.tsを責務別（auth、sync/deploy、copy/clipboard、creation、sort/filter、settings呼び出し等）に小分割し、登録エントリで束ねる
    - [x] settingsPanel分割：設定取得/更新ロジックとQuickPick UI組立を分離し、configサービス化
    - [x] ツリー責務分離：zennTreeDataProviderの状態管理・ソート/ラベル生成・frontmatter I/Oを分割し、Books拡張に備える
    - [x] utils整理：汎用とUI依存をサブフォルダ化（例: utils/markdown, utils/path, ui/imageInsertion）して責務を明確化
    - [x] GitHub同期分割：sync.tsの設定取得・API呼び出し・状態管理(pending/shaMap)をモジュール分けし、エラー/リトライ方針を統一、単体テストを追加
    - [x] プレビュー強化：preview系でバックエンド起動失敗/タイムアウト時のリトライ・クリーンアップ、deactivate時の停止処理を補強
    - [x] コンテンツキャッシュ強化：contentCacheをリポ/ブランチキー付きにし、スキーマバージョン管理と衝突回避を行う
  - [x] 非同期処理の統一的ハンドリング（async/await 統一、エラーハンドリング）
  - [x] 型定義強化（any 排除、インターフェース整備）

- [x] 品質向上タスク
  - [x] Lint/format 導入と CI（GitHub Actions）整備
  - [x] 単体テスト/統合テスト追加（Commands/FS/Tree）
  - [x] README 改訂（セットアップ・認証手順・ワークフロー更新）

- [ ] Books 機能（開発中）
  - [ ] GitHub 上の books/* 構造から Tree を構築（Book/Chapter 一覧・frontmatter 読込・ソート）
  - [ ] Book/Chapter 作成コマンド（slug 生成、frontmatter 初期値、章テンプレート）
  - [ ] Book/Chapter rename/move/delete（衝突・リンク整合性のハンドリング）
  - [ ] Book の published/非公開状態管理と Open on Zenn (book URL) 生成
  - [ ] Book/Chapter の preview パス解決（zenn preview 用の urlPath 生成）
  - [ ] 競合・同期エラー時の復帰導線（Book/Chapter 向け）

- [x] 時系列ソート（Articles/Books/Drafts）
  - [x] GitHub commits API で最新コミット日時を取得し更新日時をソートキーに反映（`GET /repos/:owner/:repo/commits?path=<path>&per_page=1`）
  - [x] 作成日時取得（GraphQL `history(last:1, path:"...")` もしくは REST ページネーションで最古コミットを取得）とキャッシュ保存
  - [x] メモリ/ローカルキャッシュ（path → {updatedAt, createdAt, sha}）を導入し Refresh 時のみ更新、失敗時は名前ソートにフォールバック
  - [x] レート制限/タイムアウト時の扱い（警告表示・フォールバック）
  - [x] Tree 表示と並び順を更新日時順に切替（Articles/Books/Drafts）

- [ ] GitHub同期キャッシュ（起動高速化）
  - [x] `globalStorageUri` 配下に cache.json を保存し、Tree用のメタ（path/type/frontmatter/sha/updatedAtなど）をキャッシュ
  - [x] 起動時はキャッシュを即ロードして表示、裏で GitHub pull 実行→成功時にキャッシュを更新して再描画
  - [ ] キャッシュ失効ポリシー（例: 10分）とバージョン管理（互換性崩れ時は破棄）
  - [x] Refresh 時はキャッシュ無視で取得し、成功後キャッシュ更新。失敗時はキャッシュを維持し通知
  - [ ] パース失敗や不整合時のフォールバック（キャッシュ破棄→通常取得）

- [ ] 画像挿入（images/ に保存してリンク挿入）
  - [x] markdown 向けに DocumentPasteEditProvider を登録し、クリップボードの image/png/jpeg を検知
  - [x] DocumentDropEditProvider を登録し、ドラッグ&ドロップした画像ファイルを検知
  - [x] 画像ファイル名の生成（日時+拡張子、重複時は -1, -2 などでリネーム）
  - [x] 画像バイナリを `zenn:/images/<name>` に writeFile し、`![](/images/<name>)` を挿入する edit を返す
  - [x] 失敗時の通知とフォールバックコマンド（ファイルピッカー経由の `zennpad.insertImageFromFile` を追加）
  - [x] GitHub 同期フックで images/ 配下の変更も push/pull 対象に含める
  - [ ] 大きな画像や非対応 MIME の扱い（警告／スキップ）
    - [ ] Zenn側の制約として、画像に3MB制限がある
  - [x] [HIGH PRIORITY] zennpad.insertImageFromFileコマンドだけでなくCtrl+Vでも上記のように`/images/`以下に画像ファイルを保存し、適切なMarkdownリンクを挿入する

- [x] GitHub同期のデプロイ回数抑制（main固定・Zenn 150回/日制限対応）
  - [x] writeFile では即 push せず dirty キューに積む
  - [x] Debounce（例: 30秒無操作）でまとめコミットするスケジューラ実装
  - [x] 最小同期間隔（例: 10分）を設け commit/push を間引く
  - [x] 内容ハッシュ一致時はスキップし、無駄コミットを抑止
  - [x] 手動フラッシュコマンド（例: `ZennPad: Flush Pending Sync`）を追加
  - [x] 手動で main へ反映する `ZennPad: DeployToZenn` コマンドを追加（デプロイ回数を Publish 時に限定）
  - [x] Tree で未同期ステータス表示（例: ● 未同期 / ✓ 同期済み）
  - [ ] レート制限/タイムアウト時のフォールバックとリトライ導線を実装

- [x] ブランチ戦略（work/main 分離）
  - [x] `zennpad.workBranch` 設定を追加（デフォルト zenn-work）し、通常の保存・自動同期は work ブランチに対して行う
  - [x] Publish 時のみ work → main に反映する仕組みを追加（Contents API か Git Data API でブランチを切り替え/マージ）
  - [x] Zenn 側の監視ブランチは main 固定とし、デプロイ回数を Publish 回数に収束させる
  - [x] UI/通知で現在のターゲットブランチを明示し、Publish 実行時の確認ダイアログを挟む
  - [x] 設定変更時のガード（owner/repo/branch 未設定や不一致時の警告）

- [x] フロントマッター emoji のランダム生成
  - [x] 候補絵文字セットを用意し、frontmatter 初期値生成時にランダム選択するユーティリティを追加
  - [x] `newArticle`/`newBook`/`newChapter` の生成フローで emoji をユーティリティに置き換える
  - [x] ユーザーが入力した場合はそれを優先し、未入力時のみランダムを使用する分岐を入れる
  - [x] テスト用に固定シード・モックを使える形にしておく（安定した検証のため）

- [ ] Help、記事作成ガイドをVSCodeのWebviewで表示する機能を追加
  - [ ] Help コマンドを追加し、WebviewPanel を開く
  - [ ] Zenn の記事作成ガイドページを埋め込み、Webview 内で表示
  - [ ] Webview 内でのリンククリックを外部ブラウザで開くように制御
  - [ ] ユーザーが必要に応じてアクセスできるように、Activity Bar に Help ノードを追加

- [x] UI改善：TreeView アイコンのカスタマイズ
  - [x] コアUI
    - [x] Articles ノードにページアイコンを設定
    - [x] Drafts ノードに鉛筆アイコンを設定
    - [x] Books ノードに本アイコンを設定
    - [x] Images ノードにメディアアイコンを設定
    - [x] @package.json の `icon` プロパティを適切なアイコンファイルに設定し、拡張機能全体のアイコンを改善
    - [x] DeployボタンをActivity Barに追加し、ワンクリックでZennへのデプロイを実行できるようにする
    - [x] Pause/Resume SyncボタンをActivity Barに追加し、GitHubとの自動同期を一時停止・再開できるようにする
    - [x] SortByDateボタン/SortByNameボタンをActivity Barに追加し、TreeViewの表示順を日付順・名前順で切り替えられるようにする
    - [x] SortByDateとSortByNameの状態をトグル式にし、現在のソート順を視覚的に示す
  - [x] [HIGH PRIORITY] SettingsボタンをActivity Barに追加し、以下の要素を含む設定パネルを開けるようにする
    - GitHubリポジトリ設定（owner/repo/branch）
      - owner：デフォルト: GitHub認証に使用しているアカウント名
      - repo: 認証時に指定　or `<username>-zenn`
      - mainBranch: main
      - workBranch: zenn-work
    - Zennのアカウント設定（Optional）
      - ここで指定されたアカウントが`zenn.dev/{username}`として、Open on Zennコマンドで使用される
      - 指定されていない場合は、デフォルトでGitHub認証に使用しているアカウント名を利用する
      - デフォルト: 空欄（GitHub認証アカウント名を使用）
    - (<divider />)
    - 自動同期の有効/無効切替
    - サインイン/サインアウト
    - (<divider />)
    - サインイン中のアカウント名/repo名表示
  - [x] Activity BarのタイトルバーのUI修正
    - [x] SyncPause/SyncOn を1つのボタンに集約し、トグルで状態を切り替えるように。また、状態に合わせたアイコンを表示すること
    - [x] SortByDate/SortByTitle を1つのボタンに集約し、トグルで状態を切り替えるように。また、状態に合わせたアイコンを表示すること
  - [x] ステータスバー実装
    - [x] スピナーを表示するヘルパー (StatusBarController.withSpinner) を追加し、deployToZenn と pauseAutoSync / resumeAutoSync 実行中に $(sync~spin) で進行中を示すようにした
    - [x] `Github(<uesr-id>/<repo-name>) -> Zenn(<user-id>)`的なソースとDistがわかりやすくなるような表示をステータスバーに表示したい。
    - [ ] ステータスバーの表示に「media/logo-only-white.svg」や「media/logo-only.svg」を使用
  - [x] コンテキストウィンドウのUI修正
    - [x] 「ZennPad: <コマンドを名>」と表示されているのを「<コマンド名>」としたい。愚直にZennPadを取り除くとVSCodeの検索で出てこなくなるため注意
    - [x] 現在はすべてのコマンドが並列だが、ディバイダーをいれるなどしてコマンドの種類ごとにある程度整理して提示するようにしたい
  - [x] エディター側のコンテキストウィンドウ
    - [x] 以下のコマンドをコンテキストウィンドウに追加する
      - [ ] Preview
      - [x] Insert image
      - [x] Make unpublished(published: trueのみ)
      - [x] Make published(published: falseのみ)
      - [x] Deploy to Zenn
      - [x] Open in GitHub
      - [x] Open in Zenn(published: trueのみ)
      - [x] Copy GitHub URL
      - [x] Copy Zenn URL(published: trueのみ)
  - [ ] Preview開始ボタンの横(`editor/title`)に「Open on Zenn/ Zennで開く」ボタンを追加する
  - [x] 多言語対応

- [ ] identifierを`zennpad`に変更

- [ ] Marketplaceに公開(https://marketplace.visualstudio.com/)
  - [ ] VSIXファイルフォーマットに変換

## メモ

- GitHub連携、プレビュー、画像貼り付け、work/mainデプロイなどのコア機能はひと通り実装済み。残件は Books/PAT対応やキャッシュ失効ポリシーなど。
- UI 開発が走る際は screenshot 自動生成タスクを Makefile + Python スクリプトで用意し、AGENTS.md に利用手順を追記すること。
