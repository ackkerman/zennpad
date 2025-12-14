import path from "path";
import * as vscode from "vscode";
import { ZennFsProvider } from "../fs/zennFsProvider";
import { parseFrontmatter } from "../utils/markdown/frontmatter";

interface SearchOptions {
  readonly caseSensitive: boolean;
  readonly wordMatch: boolean;
  readonly useRegex: boolean;
}

interface SearchResult {
  readonly path: string;
  readonly fileName: string;
  readonly title?: string;
  readonly matchTargets: Array<"filename" | "title" | "body">;
  readonly score: number;
  readonly matches: SearchMatch[];
}

interface SearchMatch {
  readonly target: "filename" | "title" | "body";
  readonly snippet?: string;
}

export class SearchViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = "zennpad.search";
  private view: vscode.WebviewView | undefined;
  private lastQuery:
    | {
        query: string;
        options: SearchOptions;
      }
    | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly fsProvider: ZennFsProvider,
    private readonly scheme: string
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = this.renderWebview(vscode.env.language ?? "en");

    const subscriptions: vscode.Disposable[] = [];
    subscriptions.push(
      webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
        const { type } = (message as { type?: string }) ?? {};
        if (type === "search") {
          const { query, options } = message as {
            query?: string;
            options?: Partial<SearchOptions>;
          };
          this.lastQuery = { query: query ?? "", options: normalizeOptions(options) };
          await this.executeSearch(this.lastQuery.query, this.lastQuery.options);
        }
        if (type === "open") {
          const { path: targetPath } = message as { path?: string };
          if (targetPath) {
            await this.openPath(targetPath);
          }
        }
        if (type === "action") {
          const { command } = message as { command?: string };
          if (command === "signIn") {
            void vscode.commands.executeCommand("zennpad.signIn");
          }
          if (command === "openSettings") {
            void vscode.commands.executeCommand("zennpad.openSettingsPanel");
          }
        }
      }),
      this.fsProvider.onDidMutate(async () => {
        if (this.lastQuery) {
          await this.executeSearch(this.lastQuery.query, this.lastQuery.options);
        }
      })
    );

    webviewView.onDidDispose(() => {
      for (const disposable of subscriptions) {
        disposable.dispose();
      }
      this.view = undefined;
    });
  }

  private async executeSearch(query: string, options: SearchOptions): Promise<void> {
    if (!this.view) {
      return;
    }
    if (!query.trim()) {
      this.postResults([]);
      return;
    }
    let matcher: RegExp;
    try {
      matcher = buildMatcher(query, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.postResults([], message);
      return;
    }
    const entries = this.fsProvider.snapshot();
    const results: SearchResult[] = [];

    for (const entry of entries) {
      if (entry.type !== vscode.FileType.File || !entry.data) {
        continue;
      }
      if (!entry.path.endsWith(".md")) {
        continue;
      }
      const fileText = Buffer.from(entry.data, "base64").toString("utf8");
      const { frontmatter, body } = parseFrontmatter(fileText);
      const title = typeof frontmatter.title === "string" ? frontmatter.title : undefined;
      const fileName = path.basename(entry.path);
      const matchTargets: SearchResult["matchTargets"] = [];
      const matchSnippets: SearchMatch[] = [];
      if (testRegex(fileName, matcher)) {
        matchTargets.push("filename");
        matchSnippets.push(...collectMatches(fileName, matcher, "filename"));
      }
      if (title && testRegex(title, matcher)) {
        matchTargets.push("title");
        matchSnippets.push(...collectMatches(title, matcher, "title"));
      }
      if (body && testRegex(body, matcher)) {
        matchTargets.push("body");
        matchSnippets.push(...collectMatches(body, matcher, "body"));
      }
      if (matchTargets.length === 0) {
        continue;
      }
      const primaryTarget = matchTargets[0];
      const score = targetScore(primaryTarget);
      results.push({
        path: entry.path,
        fileName,
        title,
        matchTargets,
        score,
        matches: matchSnippets
      });
    }

    results.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.path.localeCompare(b.path);
    });

    this.postResults(results);
  }

  private postResults(results: SearchResult[], error?: string): void {
    if (!this.view) {
      return;
    }
    this.view.webview.postMessage({ type: "results", results, error });
  }

  private async openPath(targetPath: string): Promise<void> {
    const uri = vscode.Uri.from({ scheme: this.scheme, path: targetPath });
    try {
      await vscode.window.showTextDocument(uri);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`[ZennPad] Failed to open ${targetPath}: ${message}`);
    }
  }

  private renderWebview(locale: string): string {
    const labels = localizedLabels(locale);
    const htmlLang = labels.lang ?? "en";
    const labelsJson = JSON.stringify(labels);
    const nonce = generateNonce();
    const styles = `
      :root {
        color-scheme: light dark;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif;
      }
      body {
        margin: 0;
        padding: 0.75rem;
      }
      .searchbar {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin-bottom: 0.75rem;
        padding: 0.2rem 0.35rem;
        border: 1px solid var(--vscode-input-border, #d1d5db);
        border-radius: 6px;
        background: var(--vscode-input-background, #f9fafb);
        box-shadow: 0 1px 1px rgba(0,0,0,0.04);
      }
      .action-bar {
        display: flex;
        gap: 0.4rem;
        margin-bottom: 0.5rem;
      }
      .primary-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.45rem 0.85rem;
        border-radius: 6px;
        border: 1px solid #0f9d58;
        background: linear-gradient(180deg, #12b262 0%, #0f9d58 100%);
        color: #fff;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(0,0,0,0.16);
      }
      .primary-btn.ghost {
        border: 1px solid #0f9d58;
        background: transparent;
        color: #0f9d58;
      }
      .primary-btn:active {
        transform: translateY(1px);
      }
      .chevron {
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--vscode-input-border, #d1d5db);
        border-radius: 4px;
        background: var(--vscode-input-background, #fff);
        color: var(--vscode-input-foreground, #6b7280);
      }
      .search-input {
        flex: 1;
        padding: 0.45rem 0.75rem;
        border-radius: 4px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--vscode-input-foreground);
      }
      .search-input::placeholder {
        color: var(--vscode-input-placeholderForeground, #9ca3af);
      }
      .search-input:focus {
        outline: none;
      }
      .searchbar:focus-within {
        border-color: var(--vscode-focusBorder, #4a90e2);
        box-shadow: 0 0 0 1px var(--vscode-focusBorder, #4a90e2);
      }
      .toggles {
        display: flex;
        gap: 0.15rem;
        margin-left: auto;
      }
      .toggle {
        min-width: 32px;
        height: 28px;
        padding: 0 0.4rem;
        border: 1px solid var(--vscode-input-border, #d1d5db);
        background: var(--vscode-input-background, #fff);
        color: var(--vscode-input-foreground, #6b7280);
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.85rem;
      }
      .toggle[data-active="true"] {
        background: var(--vscode-inputOption-activeBackground, #e5f2ff);
        color: var(--vscode-inputOption-activeForeground, #1f2937);
        border-color: var(--vscode-inputOption-activeBorder, #4a90e2);
      }
      .results {
        border: 1px solid var(--vscode-editorWidget-border, #cccccc);
        border-radius: 8px;
        padding: 0.5rem;
        max-height: 70vh;
        overflow: auto;
        background: var(--vscode-editor-background);
      }
      .empty {
        opacity: 0.7;
        margin: 0.5rem;
      }
      details {
        border-bottom: 1px solid var(--vscode-editorWidget-border, #e5e5e5);
        padding: 0.35rem 0;
      }
      details:last-child {
        border-bottom: none;
      }
      summary {
        list-style: none;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      summary::-webkit-details-marker {
        display: none;
      }
      .path {
        font-weight: 600;
        color: var(--vscode-textLink-foreground);
      }
      .meta {
        display: flex;
        gap: 0.25rem;
        flex-wrap: wrap;
      }
      .badge {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border-radius: 12px;
        padding: 0.1rem 0.6rem;
        font-size: 0.75rem;
      }
      .matches {
        margin-top: 0.35rem;
        display: grid;
        gap: 0.25rem;
      }
      .match {
        padding: 0.35rem 0.4rem;
        border-radius: 4px;
        background: var(--vscode-editor-lineHighlightBackground, rgba(0,0,0,0.05));
        border: 1px solid var(--vscode-editorWidget-border, transparent);
        color: var(--vscode-foreground);
      }
      .match-target {
        font-weight: 600;
        margin-right: 0.3rem;
        color: var(--vscode-textLink-foreground);
      }
      .snippet {
        opacity: 0.85;
      }
      .error {
        color: var(--vscode-editorError-foreground, #ff4d4f);
        margin-bottom: 0.5rem;
      }
    `;

    const script = `
      const vscode = acquireVsCodeApi();
      const state = {
        caseSensitive: false,
        wordMatch: false,
        useRegex: false
      };
      const labels = ${labelsJson};
      const input = document.getElementById("search-input");
      const toggles = document.querySelectorAll(".toggle");
      const resultsEl = document.getElementById("results");
      const errorEl = document.getElementById("error");

      toggles.forEach((btn) => {
        btn.addEventListener("click", () => {
          const key = btn.getAttribute("data-key");
          state[key] = !state[key];
          btn.dataset.active = String(state[key]);
          triggerSearch();
        });
      });

      let searchTimer;
      input.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(triggerSearch, 200);
      });

      document.querySelectorAll(".primary-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const command = btn.getAttribute("data-command");
          vscode.postMessage({ type: "action", command });
        });
      });

      function triggerSearch() {
        vscode.postMessage({ type: "search", query: input.value, options: state });
      }

      window.addEventListener("message", (event) => {
        const { type, results = [], error } = event.data || {};
        if (type !== "results") return;
        errorEl.textContent = error ? error : "";
        if (!results.length) {
          resultsEl.innerHTML = '<div class="empty">' + labels.emptyResults + '</div>';
          return;
        }
        resultsEl.innerHTML = results
          .map((item) => {
            const badges = item.matchTargets
              .map((t) => '<span class="badge">' + label(t) + "</span>")
              .join("");
            const matches = item.matches
              .map((m) => {
                const snippet = m.snippet ? '<span class="snippet">' + escapeHtml(m.snippet) + "</span>" : "";
                return '<div class="match"><span class="match-target">' + label(m.target) + "</span>" + snippet + "</div>";
              })
              .join("");
            const title = item.title ? '<div>' + escapeHtml(item.title) + "</div>" : "";
            return (
              '<details open>' +
              '<summary data-path="' +
              item.path +
              '">' +
              '<div class="path">' +
              escapeHtml(item.fileName) +
              "</div>" +
              title +
              '<div class="meta">' +
              badges +
              "</div>" +
              "</summary>" +
              '<div class="matches">' +
              matches +
              "</div>" +
              "</details>"
            );
          })
          .join("");

        resultsEl.querySelectorAll("summary").forEach((node) => {
          node.addEventListener("click", (e) => {
            if (e.detail === 2) {
              const targetPath = node.getAttribute("data-path");
              vscode.postMessage({ type: "open", path: targetPath });
            }
          });
        });
      });

      function label(target) {
        if (target === "filename") return labels.matchFilename;
        if (target === "title") return labels.matchTitle;
        return labels.matchBody;
      }

      function escapeHtml(text) {
        return text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }
    `;

    return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${styles}</style>
</head>
<body>
  <form class="searchbar" onsubmit="return false;">
    <input
      id="search-input"
      class="search-input"
      type="text"
      placeholder="${labels.placeholder}"
      aria-label="${labels.placeholder}"
      autofocus
    />
    <div class="toggles">
      <button type="button" class="toggle" data-key="caseSensitive" data-active="false" aria-label="${labels.toggleCase}" title="${labels.toggleCase}">Aa</button>
      <button type="button" class="toggle" data-key="wordMatch" data-active="false" aria-label="${labels.toggleWord}" title="${labels.toggleWord}">ab|</button>
      <button type="button" class="toggle" data-key="useRegex" data-active="false" aria-label="${labels.toggleRegex}" title="${labels.toggleRegex}">.*</button>
    </div>
  </form>
  <div id="error" class="error"></div>
  <div id="results" class="results">
    <div class="empty">${labels.emptyResults}</div>
  </div>
  <script nonce="${nonce}">${script}</script>
</body>
</html>`;
  }
}

function normalizeOptions(options?: Partial<SearchOptions>): SearchOptions {
  return {
    caseSensitive: Boolean(options?.caseSensitive),
    wordMatch: Boolean(options?.wordMatch),
    useRegex: Boolean(options?.useRegex)
  };
}

function buildMatcher(query: string, options: SearchOptions): RegExp {
  const flags = options.caseSensitive ? "g" : "gi";
  if (options.useRegex) {
    return new RegExp(query, flags);
  }
  const escaped = escapeRegExp(query);
  const pattern = options.wordMatch ? `\\b${escaped}\\b` : escaped;
  return new RegExp(pattern, flags);
}

function testRegex(text: string, regex: RegExp): boolean {
  regex.lastIndex = 0;
  return regex.test(text);
}

function collectMatches(
  source: string,
  regex: RegExp,
  target: SearchMatch["target"],
  limit = 3
): SearchMatch[] {
  const locator = regex.flags.includes("g") ? regex : new RegExp(regex.source, `${regex.flags}g`);
  locator.lastIndex = 0;
  const matches: SearchMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = locator.exec(source)) && matches.length < limit) {
    const index = match.index;
    const start = Math.max(0, index - 50);
    const end = Math.min(source.length, index + 120);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < source.length ? "…" : "";
    matches.push({
      target,
      snippet: `${prefix}${source.slice(start, end).replace(/\\s+/g, " ")}${suffix}`
    });
    if (locator.lastIndex === match.index) {
      locator.lastIndex += 1; // zero-length match guard
    }
  }
  if (matches.length === 0) {
    return [{ target }];
  }
  return matches;
}

function targetScore(target: SearchResult["matchTargets"][number]): number {
  switch (target) {
    case "filename":
      return 0;
    case "title":
      return 1;
    default:
      return 2;
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function localizedLabels(locale: string): {
  lang: string;
  placeholder: string;
  toggleCase: string;
  toggleWord: string;
  toggleRegex: string;
  emptyResults: string;
  matchFilename: string;
  matchTitle: string;
  matchBody: string;
  signIn: string;
  openSettings: string;
} {
  const lang = (locale || "en").toLowerCase();
  if (lang.startsWith("ja")) {
    return {
      lang: "ja",
      placeholder: "検索",
      toggleCase: "大文字小文字を区別",
      toggleWord: "単語単位で検索",
      toggleRegex: "正規表現を使用",
      emptyResults: "検索結果はありません。",
      matchFilename: "ファイル名",
      matchTitle: "タイトル",
      matchBody: "本文",
      signIn: "GitHub にサインイン",
      openSettings: "設定を開く"
    };
  }
  return {
    lang: "en",
    placeholder: "Search",
    toggleCase: "Match case",
    toggleWord: "Match whole word",
    toggleRegex: "Use regex",
    emptyResults: "No results found.",
    matchFilename: "Filename",
    matchTitle: "Title",
    matchBody: "Body",
    signIn: "Sign in to GitHub",
    openSettings: "Open Settings"
  };
}

function generateNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 16; i += 1) {
    value += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return value;
}
