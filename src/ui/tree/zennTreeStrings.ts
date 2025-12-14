export function localizedStrings(locale: string): {
  signIn: string;
  signInDesc: string;
  openSettings: string;
  openSettingsDesc: string;
  drafts: string;
  articles: string;
  books: string;
  images: string;
  imagePathPrefix: string;
} {
  const lang = (locale || "en").toLowerCase();
  if (lang.startsWith("ja")) {
    return {
      signIn: "GitHub にサインイン",
      signInDesc: "GitHub 認証が必要です",
      openSettings: "設定を開く",
      openSettingsDesc: "ZennPad 設定を開く",
      drafts: "Drafts / Daily",
      articles: "Articles",
      books: "Books",
      images: "Images",
      imagePathPrefix: "/images"
    };
  }
  return {
    signIn: "Sign in to GitHub",
    signInDesc: "GitHub authentication required",
    openSettings: "Open Settings",
    openSettingsDesc: "Open ZennPad settings",
    drafts: "Drafts / Daily",
    articles: "Articles",
    books: "Books",
    images: "Images",
    imagePathPrefix: "/images"
  };
}
