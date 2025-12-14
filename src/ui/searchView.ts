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

interface WelcomeSlide {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly actionCommand?: string;
}

interface LocalizedLabels {
  lang: string;
  placeholder: string;
  toggleCase: string;
  toggleWord: string;
  toggleRegex: string;
  emptyResults: string;
  matchFilename: string;
  matchTitle: string;
  matchBody: string;
  welcomeBadge: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  prevSlide: string;
  nextSlide: string;
  slideIndicator: string;
  welcomeSlides: WelcomeSlide[];
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
    void this.initWebview(webviewView);

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
          const commandMap: Record<string, string> = {
            signIn: "zennpad.signIn",
            openSettings: "zennpad.openSettingsPanel",
            openHelp: "zennpad.openHelpGuide",
            refresh: "zennpad.refresh"
          };
          const target = command ? commandMap[command] : undefined;
          if (target) {
            void vscode.commands.executeCommand(target);
          }
        }
      }),
      this.fsProvider.onDidMutate(async () => {
        if (this.lastQuery) {
          await this.executeSearch(this.lastQuery.query, this.lastQuery.options);
        }
      }),
      vscode.authentication.onDidChangeSessions(async (event) => {
        if (event.provider.id === "github" && this.view) {
          await this.initWebview(this.view);
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
    const session = await vscode.authentication.getSession("github", ["repo"], {
      createIfNone: false,
      silent: true
    });
    if (!session) {
      this.view.webview.postMessage({ type: "requireSignIn" });
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

  private async initWebview(view: vscode.WebviewView): Promise<void> {
    const session = await vscode.authentication.getSession("github", ["repo"], {
      createIfNone: false,
      silent: true
    });
    const signedIn = Boolean(session);
    view.webview.html = this.renderWebview(vscode.env.language ?? "en", signedIn);
  }

  private renderWebview(locale: string, signedIn: boolean): string {
    const labels = localizedLabels(locale);
    const htmlLang = labels.lang ?? "en";
    const labelsJson = JSON.stringify(labels);
    const signedInFlag = signedIn ? "true" : "false";
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
      .panel {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .notice {
        border: 1px solid var(--vscode-input-border, rgba(148, 163, 184, 0.35));
        border-radius: 8px;
        padding: 0.75rem 0.85rem;
        background: var(--vscode-editor-background, #0b1120);
        color: var(--vscode-foreground);
      }
      .notice .actions {
        margin-top: 0.55rem;
        display: inline-flex;
        gap: 0.45rem;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.7rem;
        border-radius: 7px;
        border: 1px solid var(--vscode-input-border, rgba(148, 163, 184, 0.4));
        background: transparent;
        color: var(--vscode-foreground);
        cursor: pointer;
      }
      .btn.primary {
        border-color: #0f9d58;
        color: #0f9d58;
      }
      .panel {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .notice {
        border: 1px solid var(--vscode-input-border, rgba(148, 163, 184, 0.35));
        border-radius: 8px;
        padding: 0.75rem 0.85rem;
        background: var(--vscode-editor-background, #0b1120);
        color: var(--vscode-foreground);
      }
      .notice .actions {
        margin-top: 0.55rem;
        display: inline-flex;
        gap: 0.45rem;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.7rem;
        border-radius: 7px;
        border: 1px solid var(--vscode-input-border, rgba(148, 163, 184, 0.4));
        background: transparent;
        color: var(--vscode-foreground);
        cursor: pointer;
      }
      .btn.primary {
        border-color: #0f9d58;
        color: #0f9d58;
      }
      .welcome {
        border: 1px solid var(--vscode-editorWidget-border, #cccccc);
        border-radius: 10px;
        background: linear-gradient(180deg, rgba(15, 157, 88, 0.08) 0%, rgba(15, 157, 88, 0.02) 100%);
        padding: 0.9rem 0.85rem;
        display: grid;
        gap: 0.65rem;
      }
      .welcome-head {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .welcome-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        background: rgba(15, 157, 88, 0.12);
        color: var(--vscode-textLink-foreground);
        font-size: 0.8rem;
        font-weight: 600;
        width: fit-content;
      }
      .welcome-title {
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--vscode-foreground);
      }
      .welcome-subtitle {
        color: var(--vscode-descriptionForeground, #6b7280);
        font-size: 0.95rem;
        line-height: 1.4;
      }
      .carousel-card {
        border: 1px solid var(--vscode-editorWidget-border, #d1d5db);
        border-radius: 8px;
        padding: 0.75rem;
        background: var(--vscode-editor-background);
        box-shadow: 0 4px 14px rgba(0,0,0,0.05);
      }
      .carousel-eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-size: 0.8rem;
        color: var(--vscode-textLink-foreground);
        margin-bottom: 0.25rem;
      }
      .carousel-title {
        font-size: 1rem;
        font-weight: 700;
        margin-bottom: 0.25rem;
      }
      .carousel-desc {
        color: var(--vscode-descriptionForeground, #6b7280);
        line-height: 1.5;
      }
      .carousel-actions {
        margin-top: 0.55rem;
      }
      .carousel-footer {
        margin-top: 0.65rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .dots {
        display: inline-flex;
        gap: 0.35rem;
        align-items: center;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        border: 1px solid var(--vscode-input-border, #d1d5db);
        background: transparent;
        padding: 0;
        cursor: pointer;
      }
      .dot[data-active="true"] {
        background: var(--vscode-textLink-foreground);
        border-color: var(--vscode-textLink-foreground);
      }
      .carousel-indicator {
        margin-top: 0.3rem;
        font-size: 0.85rem;
        color: var(--vscode-descriptionForeground, #6b7280);
        text-align: right;
      }
      .searchbar {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin-bottom: 0.75rem;
        padding: 0.2rem 0.35rem;
        border: 1px solid var(--vscode-editorWidget-border, #cccccc);
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
        border: 1px solid var(--vscode-input-border, #cccccc);
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
        border: 1px solid var(--vscode-input-border, #cccccc);
        background: var(--vscode-input-background, #cccccc);
        color: var(--vscode-input-foreground, #6b7280);
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.85rem;
      }
      .toggle[data-active="true"] {
        background: var(--vscode-inputOption-activeBackground, #cccccc);
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
      const signedIn = ${signedInFlag};
      const shouldShowProductTour = !signedIn;
      const slides = Array.isArray(labels.welcomeSlides) ? labels.welcomeSlides : [];
      let activeSlide = 0;
      const input = document.getElementById("search-input");
      const toggles = document.querySelectorAll(".toggle");
      const resultsEl = document.getElementById("results");
      const errorEl = document.getElementById("error");
      const searchArea = document.getElementById("search-area");
      const searchBar = document.querySelector(".searchbar");

      const actionButtons = document.querySelectorAll("[data-action]");
      actionButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const command = btn.getAttribute("data-action");
          vscode.postMessage({ type: "action", command });
        });
      });

      if (!signedIn && searchArea) {
        searchArea.style.display = "block";
        if (searchBar) {
          searchBar.style.display = "none";
        }
        renderProductTour();
      } else if (signedIn && searchArea) {
        searchArea.style.display = "block";
        if (searchBar) {
          searchBar.style.display = "";
        }
        renderEmptyResults();
      }

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
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          triggerSearch();
        }
      });

      function wirePrimaryButtons(scope) {
        (scope || document).querySelectorAll(".primary-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const command = btn.getAttribute("data-command");
            if (command) {
              vscode.postMessage({ type: "action", command });
            }
          });
        });
      }

      function triggerSearch() {
        const query = input.value;
        if (!query.trim()) {
          if (shouldShowProductTour) {
            renderProductTour();
          } else {
            renderEmptyResults();
          }
          return;
        }
        if (!signedIn) {
          renderProductTour();
          return;
        }
        vscode.postMessage({ type: "search", query, options: state });
      }

      window.addEventListener("message", (event) => {
        const { type, results = [], error } = event.data || {};
        if (type === "requireSignIn") {
          if (searchArea) {
            searchArea.style.display = "block";
            if (searchBar) {
              searchBar.style.display = "none";
            }
            renderProductTour();
          }
          return;
        }
        if (type !== "results") return;
        errorEl.textContent = error ? error : "";
        if (!results.length) {
          if (!input.value.trim()) {
            if (shouldShowProductTour) {
              renderProductTour();
            } else {
              renderEmptyResults();
            }
            return;
          }
          renderEmptyResults();
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

      function renderProductTour() {
        if (!slides.length) {
          renderEmptyResults();
          return;
        }
        if (activeSlide >= slides.length) {
          activeSlide = 0;
        }
        const slide = slides[activeSlide] || slides[0];
        const dots = slides
          .map(
            (_, index) =>
              '<button class="dot" data-index="' +
              index +
              '" aria-label="' +
              formatIndicatorText(index, slides.length) +
              '" data-active="' +
              (index === activeSlide) +
              '"></button>'
          )
          .join("");
        const actionButton = slide.actionLabel
          ? '<div class="carousel-actions"><button class="primary-btn" data-command="' +
            (slide.actionCommand || "") +
            '">' +
            slide.actionLabel +
            "</button></div>"
          : "";
        resultsEl.innerHTML =
          '<div class="welcome">' +
          '<div class="welcome-head">' +
          '<span class="welcome-badge">' +
          labels.welcomeBadge +
          "</span>" +
          '<div class="welcome-title">' +
          labels.welcomeTitle +
          "</div>" +
          '<div class="welcome-subtitle">' +
          labels.welcomeSubtitle +
          "</div>" +
          "</div>" +
          '<div class="carousel-card">' +
          '<div class="carousel-eyebrow">' +
          slide.eyebrow +
          "</div>" +
          '<div class="carousel-title">' +
          slide.title +
          "</div>" +
          '<div class="carousel-desc">' +
          slide.description +
          "</div>" +
          actionButton +
          '<div class="carousel-footer">' +
          '<button class="chevron" data-direction="prev" aria-label="' +
          labels.prevSlide +
          '">&lt;</button>' +
          '<div class="dots">' +
          dots +
          "</div>" +
          '<button class="chevron" data-direction="next" aria-label="' +
          labels.nextSlide +
          '">&gt;</button>' +
          "</div>" +
          '<div class="carousel-indicator">' +
          formatIndicatorText(activeSlide, slides.length) +
          "</div>" +
          "</div>" +
          "</div>";
        wirePrimaryButtons(resultsEl);
        bindCarouselControls();
      }

      function renderEmptyResults() {
        resultsEl.innerHTML = '<div class="empty">' + labels.emptyResults + "</div>";
      }

      function bindCarouselControls() {
        resultsEl.querySelectorAll("[data-direction]").forEach((btn) => {
          btn.addEventListener("click", () => {
            if (!slides.length) return;
            const direction = btn.getAttribute("data-direction");
            if (direction === "prev") {
              activeSlide = (activeSlide - 1 + slides.length) % slides.length;
            } else {
              activeSlide = (activeSlide + 1) % slides.length;
            }
            renderProductTour();
          });
        });
        resultsEl.querySelectorAll(".dot").forEach((dot) => {
          dot.addEventListener("click", () => {
            const index = Number(dot.getAttribute("data-index"));
            if (!Number.isNaN(index)) {
              activeSlide = index;
              renderProductTour();
            }
          });
        });
      }

      function formatIndicatorText(index, total) {
        return (labels.slideIndicator || "{current}/{total}")
          .replace("{current}", String(index + 1))
          .replace("{total}", String(total));
      }

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
  <div class="panel">
    <div id="search-area">
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
    </div>
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

function localizedLabels(locale: string): LocalizedLabels {
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
      welcomeBadge: "ようこそ",
      welcomeTitle: "ZennPad で Zenn の執筆を完結させる",
      welcomeSubtitle: "サイドバーから検索、プレビュー、デプロイまでを直感的に操作できます。",
      prevSlide: "前の紹介",
      nextSlide: "次の紹介",
      slideIndicator: "{current}/{total} 枚目",
      welcomeSlides: [
        {
          eyebrow: "セットアップ",
          title: "GitHub 連携で Zenn リポジトリを同期",
          description:
            "owner/repo とブランチを設定すると、記事・Book・画像まで自動で読み込みます。",
          actionLabel: "設定を開く",
          actionCommand: "openSettings"
        },
        {
          eyebrow: "プレビュー",
          title: "Zenn 互換プレビューをすぐに確認",
          description:
            "ミラーされたワークスペースと zenn preview で、ブラウザを開かず Markdown の見た目を確認できます。",
          actionLabel: "ヘルプガイドを見る",
          actionCommand: "openHelp"
        },
        {
          eyebrow: "ワークフロー",
          title: "全文検索とリフレッシュで素早く執筆",
          description:
            "ファイル名・タイトル・本文を一括検索し、必要に応じてリフレッシュして最新コンテンツを取り込み、デプロイにつなげます。",
          actionLabel: "リポジトリを更新",
          actionCommand: "refresh"
        }
      ]
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

    welcomeBadge: "Product tour",
    welcomeTitle: "Manage Zenn without leaving VS Code",
    welcomeSubtitle: "Search, preview, and deploy directly from the sidebar.",
    prevSlide: "Previous highlight",
    nextSlide: "Next highlight",
    slideIndicator: "Slide {current} of {total}",
    welcomeSlides: [
      {
        eyebrow: "Setup",
        title: "Connect your Zenn repository",
        description:
          "Set GitHub owner/repo and branches to sync articles, books, and images into the explorer.",
        actionLabel: "Open settings",
        actionCommand: "openSettings"
      },
      {
        eyebrow: "Preview",
        title: "Check Zenn-ready previews instantly",
        description:
          "A mirrored workspace feeds zenn preview so you can validate Markdown rendering without switching windows.",
        actionLabel: "Read the help guide",
        actionCommand: "openHelp"
      },
      {
        eyebrow: "Workflow",
        title: "Search and refresh before you deploy",
        description:
          "Search filenames, titles, and bodies at once, then refresh to pull the latest content before publishing.",
        actionLabel: "Refresh content",
        actionCommand: "refresh"
      }
    ]
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
