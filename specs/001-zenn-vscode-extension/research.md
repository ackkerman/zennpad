# Phase 0 Research: ZennPad VS Code拡張

## GitHub同期戦略
- **Decision**: Contents APIを基本とし、1MB超やtruncated時はGit Data APIのblob取得にフォールバック。すべてのwriteでsha検証・409検知を行い、自動同期はworkブランチ限定、mainへの反映は明示デプロイに限定する。
- **Rationale**: Zennの1MB返却制限を回避しつつ、編集衝突と誤デプロイを防ぐ。work/main分離で150回/日のデプロイ上限に合わせる。
- **Alternatives considered**: git clone + fs操作は拡張配布サイズと認証複雑化のため不採用。Contents APIのみ運用は1MB制限で不可。

## プレビューアーキテクチャ
- **Decision**: 仮想FS→ローカルミラー同期を経由し、zenn CLI previewをミラー直下で起動。get-portでポート確保し、http-proxyでWebview用の踏み台URLを提供。起動/待機/リトライを含む状態管理を行う。
- **Rationale**: Webviewはfile://を直接読めないため、同一オリジンのプロキシが必要。ミラー経由ならCLI監視が有効になり自動リロードが担保できる。
- **Alternatives considered**: Webview内で直接fetchはCORSと認証で不安定。拡張内に独自Markdownレンダラーを持つ案はZenn固有レンダリング差異が大きく却下。

## 検索体験
- **Decision**: Webview検索でファイル名>タイトル>本文の優先度付きマッチを行い、大文字小文字/単語/正規表現トグルを提供。結果を選択するとエディター/ツリーにナビゲートする。
- **Rationale**: VS Code標準検索と同等のUXを維持しつつ、Zenn frontmatter/本文を横断できる。シンプルなスコアリングで500ファイル規模でも応答2s以内を実現。
- **Alternatives considered**: サーバーサイドindexや外部検索エンジンは依存が増えオフラインで崩れるため不採用。全文インデックス常駐プロセスはメモリ消費と複雑性増大で見送り。

## 画像挿入と容量制御
- **Decision**: 貼り付け/ドラッグ/ファイル選択すべてを `/images/<timestamp[-n]>.ext` に保存し、3MB超や非対応MIMEは警告して中断。成功時にMarkdownリンクを自動挿入。
- **Rationale**: Zennの画像上限とGitHubストレージ負荷を抑制し、リンク生成の手動作業を排除して執筆体験を滑らかにする。
- **Alternatives considered**: 外部ストレージ連携はZenn公開との整合が難しく、サインインコストも増えるため不採用。

## 同期/デプロイ制御とレート保護
- **Decision**: writeをdirtyキューに積みデバウンス後にまとめpush、内容ハッシュ一致はスキップ。mainへのデプロイは手動コマンド＋確認ダイアログでのみ実行し、レート制限/429時はバックオフと再試行導線を表示。
- **Rationale**: 150回/日のデプロイ上限を守りつつ衝突・無駄コミットを減らす。ユーザーに状態を可視化し、誤操作を防ぐ。
- **Alternatives considered**: 毎保存即pushはデプロイ上限を圧迫し、競合率も高いので不採用。完全手動同期は利便性が低下するため不採用。

## キャッシュと復旧
- **Decision**: コンテンツメタと時系列情報をglobalStorageにバージョン付きで保存し、起動時はキャッシュ即表示→裏でpullして成功時のみ更新。パース失敗時はキャッシュ破棄してlive fetchにフォールバック。
- **Rationale**: 起動速度とオフライン耐性を両立しつつ整合性を確保する。
- **Alternatives considered**: キャッシュ無効は起動が重く、逆に強制キャッシュ使用は整合性リスクが高い。
