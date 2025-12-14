# Feature Specification: ZennPad VS Code拡張によるZennワークフロー統合

**Feature Branch**: `001-zenn-vscode-extension`  
**Created**: 2025-12-15  
**Status**: Draft  
**Input**: User description: "Build a VS Code extension that allows users to manage Zenn articles, books, drafts, and images directly from the editor sidebar. The extension treats a GitHub repository as a virtual workspace, enabling users to create, edit, preview, publish, and organize Zenn content without leaving VS Code. Users can: - browse and edit articles, books, drafts, and images in a tree view - generate new content with predefined templates and metadata - toggle published state and open content on Zenn or GitHub - preview content in real time using a local preview backend - insert images via paste, drag-and-drop, or file selection - search across filenames, titles, and content body - control when changes are synchronized and deployed to Zenn to avoid daily deploy limits The goal is to streamline the Zenn writing workflow into a single, UI-driven experience inside VS Code while keeping GitHub as the source of truth."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - リポ接続と安全な編集/プレビュー (Priority: P1)

GitHubで認証したユーザーがZennリポジトリをサイドバーから開き、記事や下書きを編集しながらリアルタイムプレビューを確認できる。

**Why this priority**: 編集とプレビューが最重要の作業フローであり、これが成立しないと拡張機能の価値が成立しないため。

**Independent Test**: サインイン済みの状態で1つの記事を開き、本文を編集して保存するとプレビューが直ちに更新され、メインブランチへのデプロイは手動操作まで発生しないことを検証する。

**Acceptance Scenarios**:

1. **Given** GitHub認証が完了しワークブランチがアクティブ、**When** ツリービューで記事を選択して開く、**Then** フロントマターと本文がエディターに表示されプレビューに同じパスが読み込まれる。
2. **Given** ユーザーが記事を編集して保存した状態、**When** プレビューを確認する、**Then** 最新の内容が反映され、メインブランチへのデプロイはユーザーの明示操作まで行われない。

---

### User Story 2 - 新規コンテンツ作成と公開状態管理 (Priority: P1)

ユーザーが記事/Book/Chapter/ドラフトをテンプレート付きで作成し、公開・非公開を切り替えつつZenn/GitHubリンクで確認できる。

**Why this priority**: 新規コンテンツ投入と公開制御がZenn執筆の中心であり、テンプレート化と公開状態の制御が生産性とミス防止に直結するため。

**Independent Test**: 「新規Article作成」を実行し、タイトル入力のみでファイルが生成されツリービューに追加されること、公開/非公開を切り替えるとフロントマターとリンク先URLが正しく更新されることを確認する。

**Acceptance Scenarios**:

1. **Given** ユーザーが「新規Article」コマンドを起動、**When** タイトルと必要なメタデータを入力する、**Then** 既定のテンプレートとフロントマターを含むファイルが正しいフォルダに作成されツリーに即時表示される。
2. **Given** 公開状態が未設定または非公開の記事、**When** 「Publish/Unpublish」を実行する、**Then** フロントマターのpublishedが切り替わり、Zenn/GitHubの「Open」操作が適切なURLに変わる。

---

### User Story 3 - 画像挿入と同期制御 (Priority: P2)

ユーザーが貼り付け/ドラッグ＆ドロップ/ファイル選択で画像を挿入し、同期キューを制御してデプロイ回数制限を回避する。

**Why this priority**: 画像挿入は記事品質に重要であり、デプロイ制限を守るための同期制御がZennの運用要件に適合するため。

**Independent Test**: 画像を貼り付けてMarkdownリンクが自動挿入されること、同期を一時停止した状態で変更がキューに残り、手動デプロイ時のみメインブランチに反映されることを確認する。

**Acceptance Scenarios**:

1. **Given** エディターが開かれている記事、**When** クリップボードの画像を貼り付ける、**Then** `/images/<ファイル名>` に保存される画像と対応するMarkdownリンクが本文に挿入される。
2. **Given** 同期が一時停止状態で複数の変更がある、**When** 手動で同期/デプロイを実行する、**Then** キューがまとめて反映され、デプロイ回数が意図せず増えないよう確認ダイアログが表示される。

---

### User Story 4 - 横断検索とコンフリクト復旧 (Priority: P3)

ユーザーがファイル名・タイトル・本文を横断検索し、APIレート制限やコンフリクトが発生しても導線に従い復旧できる。

**Why this priority**: 横断検索は大量コンテンツでの発見性を高め、エラー時の復旧導線がないとリポジトリの整合性が損なわれるため。

**Independent Test**: 検索バーでキーワードとトグルを指定し、結果がフィルタされて各項目を開けること、GitHub 409/429を模擬してもユーザーが再試行や再取得で復旧できることを確認する。

**Acceptance Scenarios**:

1. **Given** 検索ビューが開いている、**When** キーワードを入力し大文字小文字/単語/正規表現トグルを切り替える、**Then** ファイル名・タイトル・本文を優先度順にマッチした結果が表示され、選択すると該当箇所にジャンプできる。
2. **Given** GitHub APIから409または429が返った状況、**When** エラー通知の指示に従い再取得または待機を行う、**Then** ツリーとプレビューが最新状態に復旧し、データ損失や誤デプロイが起こらない。

### Edge Cases

- GitHub 401/403/404/409/429 が返った際、再認証・再取得・バックオフ・競合解消の選択肢を提示し安全に再試行できる。
- プレビュー/プロキシ起動に失敗した場合、理由（ポート占有・CLI未導入など）を示し、再試行・ポート変更・CLI導入手順への導線を提示する。
- デプロイ/同期ボタンの多重クリックや短時間連打を防ぎ、手動デプロイ時は確認ダイアログとターゲットブランチ表示で誤デプロイを防止する。
- 画像ファイルが大きすぎる、非対応MIME、または保存先が欠落した場合に警告を出し処理を中断し、既存ファイルを汚さない。
- ネットワーク切断中に編集した場合は変更をローカルに保持し、再接続時に競合チェック付きで同期できる。
- ツリー表示と実リポジトリ構造が不整合（予期しないフォルダ/ファイル）な場合でも崩れずに表示し、ユーザーに整合性回復手段を提供する。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: ユーザーはブラウザ経由の認証または保存済みトークンでGitHubにサインイン/サインアウトでき、認証状態を拡張内で確認できる。
- **FR-002**: 拡張はGitHubリポジトリを仮想ワークスペースとしてマウントし、Articles/Books/Chapters/Drafts/Imagesをツリービューに表示してエディターで開ける。
- **FR-003**: 新規Article/Book/Chapter/Draft作成コマンドはテンプレートとフロントマター（title/emoji/type/topics/published等）を自動生成し、重複しないスラッグ/ファイル名を付与する。
- **FR-004**: プレビューはローカルバックエンドを起動し、ユーザーが開いたパスを即時表示し、保存時に自動リロードできる。起動失敗時は理由と再試行手段を提示する。
- **FR-005**: ユーザーは記事の公開/非公開を切り替え、Zenn/GitHubへの「Open」操作が公開状態に応じたURLを使用する。
- **FR-006**: 画像挿入（貼り付け・ドラッグ＆ドロップ・ファイル選択）は `/images/<name>` に保存し、Markdownリンクを自動挿入する。非対応や容量超過時は警告して挿入を中止する。
- **FR-007**: 検索ビューはファイル名・タイトル・本文を優先度付きで横断検索し、大文字小文字/単語単位/正規表現のトグルを提供し、結果から該当箇所へ遷移できる。
- **FR-008**: 同期とデプロイはワークブランチとメインブランチを分離し、手動デプロイ時に確認ダイアログを表示する。自動同期は一時停止/再開でき、デプロイ回数を抑制するデバウンス/キューを持つ。
- **FR-009**: GitHub APIエラー（401/403/404/409/429）やネットワーク切断時にユーザー通知を行い、再認証・再取得・待機・差分マージなどの復旧導線を提供する。
- **FR-010**: ツリービューおよびコンテキストメニューからZenn/GitHubリンクのコピー、Zenn/GitHubで開く、プレビューを開く、デプロイ/同期の操作が行える。
- **FR-011**: リポジトリの構造に予期しないフォルダ/ファイルがあってもツリーに表示し、Zenn標準フォルダとの区別を示す。
- **FR-012**: ステータスバーや通知でアクティブなGitHubリポジトリ、Zennユーザー名、同期/デプロイ/プレビューの状態、未同期件数を明示する。

### Key Entities *(include if feature involves data)*

- **Zennコンテンツ項目**: type（article/book/chapter/draft/image）、slug、frontmatter（title/emoji/type/topics/published/updatedAtなど）、本文/ファイルパス。
- **ワークスペースリポジトリ**: GitHub上のowner/repo、mainブランチ、workブランチ、同期状態（sha/キュー/未同期件数）、Zennユーザー名。
- **プレビューセッション**: ミラー先のローカルディレクトリ、バックエンドポート、プロキシURL、起動状態と再試行情報。
- **検索クエリ**: キーワード、トグル設定（case-sensitive/whole-word/regex）、結果リスト（マッチ位置・ファイルパス・スコア）。
- **同期タスク**: 操作種別（pull/push/deploy）、対象パス一覧、ステータス（pending/in-progress/succeeded/failed）、エラーメッセージと復旧手段。

### Assumptions

- GitHubリポジトリはZenn標準構造（articles/books/drafts/imagesなど）を基準とするが、追加フォルダが存在しても読み取りを阻害しない。
- メインブランチはZennが監視するデプロイブランチ、ワークブランチは日常編集用とし、公開はメインへのデプロイで行う。
- 画像はZennの運用上3MB以下を推奨し、それ以上は挿入時に警告してスキップする。
- ローカル環境にZennプレビューに必要なCLIがない場合、ユーザーがインストールを行う前提で導線を提示する。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 新規リポジトリ設定から記事を開いてプレビューが表示されるまでの手順を、初回ユーザーでも3分以内に完了できる。
- **SC-002**: 新規Article/Book/Chapter/Draft作成コマンド実行からツリービューへの反映までが10秒以内で完了し、必須フロントマターが自動で埋まる成功率が100%である。
- **SC-003**: 保存後のプレビュー反映が95%の操作で2秒以内に完了し、プレビュー起動失敗時は100%のケースで再試行や代替手段の指示が表示される。
- **SC-004**: 検索クエリ実行から結果表示までがリポジトリ500ファイル規模で2秒以内、誤検出率が5%未満である。
- **SC-005**: 手動デプロイ確認ダイアログにより意図しないメインブランチ反映が0件、1日150回のデプロイ上限に対し警告/抑制が100%機能する。
- **SC-006**: GitHub認証エラー・競合・レート制限の発生時、ユーザーが提示された導線のみで復旧できる成功率が90%以上である。
