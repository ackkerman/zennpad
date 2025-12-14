export type HelpLink = {
  labelJa: string;
  labelEn: string;
  url: string;
  icon: string;
  previewPath?: string;
};

export const HELP_LINKS: HelpLink[] = [
  {
    labelJa: "記事の作成ガイド",
    labelEn: "Article guide",
    url: "http://localhost:8000/guide/zenn-cli-guide#cli-%E3%81%A7%E8%A8%98%E4%BA%8B%EF%BC%88article%EF%BC%89%E3%82%92%E7%AE%A1%E7%90%86%E3%81%99%E3%82%8B",
    icon: "📝",
    previewPath:
      "http://localhost:8000/guide/zenn-cli-guide#cli-%E3%81%A7%E8%A8%98%E4%BA%8B%EF%BC%88article%EF%BC%89%E3%82%92%E7%AE%A1%E7%90%86%E3%81%99%E3%82%8B"
  },
  {
    labelJa: "本の作成ガイド",
    labelEn: "Book guide",
    url: "http://localhost:8000/guide/zenn-cli-guide#cli-%E3%81%A7%E6%9C%AC%EF%BC%88book%EF%BC%89%E3%82%92%E7%AE%A1%E7%90%86%E3%81%99%E3%82%8B",
    icon: "📕",
    previewPath:
      "http://localhost:8000/guide/zenn-cli-guide#cli-%E3%81%A7%E6%9C%AC%EF%BC%88book%EF%BC%89%E3%82%92%E7%AE%A1%E7%90%86%E3%81%99%E3%82%8B"
  },
  {
    labelJa: "画像管理ガイド",
    labelEn: "Image guide",
    url: "http://localhost:8000/guide/deploy-github-images",
    icon: "🖼",
    previewPath: "http://localhost:8000/guide/deploy-github-images"
  },
  {
    labelJa: "マークダウン記法",
    labelEn: "Markdown",
    url: "https://zenn.dev/zenn/articles/markdown-guide",
    icon: "✏️"
  },
  {
    labelJa: "画像のアップロード",
    labelEn: "Image uploader",
    url: "https://zenn.dev/dashboard/uploader",
    icon: "📷"
  }
];

export const PRIMARY_HELP_URL =
  HELP_LINKS[0]?.url ?? "https://zenn.dev/zenn/articles/markdown-guide";

export function helpLinkLabel(link: HelpLink, locale: string): string {
  return locale.toLowerCase().startsWith("ja") ? link.labelJa : link.labelEn;
}
