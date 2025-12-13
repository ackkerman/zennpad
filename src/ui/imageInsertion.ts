import * as vscode from "vscode";
import { ZennFsProvider } from "../fs/zennFsProvider";
import path from "path";

const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];

export function registerImageInsertionProviders(
  context: vscode.ExtensionContext,
  fsProvider: ZennFsProvider,
  scheme: string
): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentPasteEditProvider(
      { language: "markdown" },
      {
        async provideDocumentPasteEdits(document, ranges, dataTransfer) {
          const imageItem = firstImageItem(dataTransfer);
          if (!imageItem) {
            return;
          }
          const file = await imageItem.item.asFile();
          if (!file) {
            return;
          }
          const baseName = slugFromUri(document.uri) ?? "pasted-image";
          const { link } = await saveImage(file, imageItem.mime, fsProvider, scheme, baseName);
          const edit = createDocumentPasteEdit(`![](${link})`, "Insert image");
          edit.additionalEdit = new vscode.WorkspaceEdit();
          edit.additionalEdit.insert(document.uri, ranges[0].start, `![](${link})`);
          return [edit];
        }
      },
      { copyMimeTypes: IMAGE_MIME_TYPES } as unknown as vscode.DocumentPasteProviderMetadata
    ),
    vscode.languages.registerDocumentDropEditProvider({ language: "markdown" }, {
      async provideDocumentDropEdits(document, position, dataTransfer) {
        const fileItem = firstFile(dataTransfer);
        if (!fileItem) {
          return;
        }
        const baseName = slugFromUri(document.uri) ?? "pasted-image";
        const { link } = await saveImage(fileItem.file, fileItem.mime, fsProvider, scheme, baseName);
        const edit = new vscode.DocumentDropEdit(`![](${link})`, "Insert image");
        edit.additionalEdit = new vscode.WorkspaceEdit();
        edit.additionalEdit.insert(document.uri, position, `![](${link})`);
        return [edit];
      }
    })
  );
}

export async function insertImageFromFile(
  fsProvider: ZennFsProvider,
  scheme: string
): Promise<void> {
  const activeDoc = vscode.window.activeTextEditor?.document;
  const baseName = (activeDoc && slugFromUri(activeDoc.uri)) || "pasted-image";
  const pick = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectMany: false,
    filters: { Images: ["png", "jpg", "jpeg", "gif", "webp"] }
  });
  if (!pick || pick.length === 0) {
    return;
  }
  const fileUri = pick[0];
  const data = await vscode.workspace.fs.readFile(fileUri);
  const ext = path.extname(fileUri.fsPath) || ".png";
  const link = await saveBuffer(data, await ensureSequentialName(baseName, ext, fsProvider), fsProvider, scheme);
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  await editor.edit((builder) => {
    builder.insert(editor.selection.active, `![](${link})`);
  });
}

function firstImageItem(
  dataTransfer: vscode.DataTransfer
): { item: vscode.DataTransferItem; mime: string } | undefined {
  for (const [mime, item] of dataTransfer) {
    if (IMAGE_MIME_TYPES.includes(mime)) {
      return { item, mime };
    }
  }
  return undefined;
}

function firstFile(
  dataTransfer: vscode.DataTransfer
): { file: vscode.DataTransferFile; mime: string } | undefined {
  for (const [mime, item] of dataTransfer) {
    const file = item.asFile();
    if (file) {
      const ext = path.extname(file.name).toLowerCase();
      if (IMAGE_MIME_TYPES.includes(mime) || [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) {
        return { file, mime };
      }
    }
  }
  return undefined;
}

async function saveImage(
  file: vscode.DataTransferFile,
  mime: string | undefined,
  fsProvider: ZennFsProvider,
  scheme: string,
  baseName: string
): Promise<{ link: string }> {
  const raw = await readFileData(file);
  const buffer = new Uint8Array(raw);
  const ext = path.extname(file.name) || guessExt(mime);
  const name = await ensureSequentialName(baseName, ext, fsProvider);
  const link = await saveBuffer(buffer, name, fsProvider, scheme);
  return { link };
}

async function saveBuffer(
  buffer: Uint8Array,
  name: string,
  fsProvider: ZennFsProvider,
  scheme: string
): Promise<string> {
  const dir = vscode.Uri.from({ scheme, path: "/images" });
  try {
    fsProvider.createDirectory(dir);
  } catch {
    // ignore
  }
  const uri = vscode.Uri.from({ scheme, path: `/images/${name}` });
  fsProvider.writeFile(uri, buffer, { create: true, overwrite: false });
  return `/images/${name}`;
}

function guessExt(mime?: string): string {
  if (!mime) return ".png";
  mime = mime.toLowerCase();
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/webp") return ".webp";
  return ".png";
}

async function ensureSequentialName(base: string, ext: string, fsProvider: ZennFsProvider): Promise<string> {
  const dir = "/images";
  let counter = 1;
  let candidate = `${base}_${String(counter).padStart(3, "0")}${ext}`;
  while (fsProvider.has(vscode.Uri.from({ scheme: "zenn", path: `${dir}/${candidate}` }))) {
    counter += 1;
    candidate = `${base}_${String(counter).padStart(3, "0")}${ext}`;
  }
  return candidate;
}

function slugFromUri(uri: vscode.Uri): string | undefined {
  const name = path.basename(uri.path, path.extname(uri.path));
  if (!name) return undefined;
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || undefined;
}

function createDocumentPasteEdit(text: string, label: string): vscode.DocumentPasteEdit {
  const ctor = (vscode as typeof vscode & { DocumentPasteEdit?: new (t: string, l: string) => vscode.DocumentPasteEdit })
    .DocumentPasteEdit;
  if (!ctor) {
    throw new Error("DocumentPasteEdit is not available in this VS Code version.");
  }
  return new ctor(text, label);
}

async function readFileData(file: vscode.DataTransferFile): Promise<ArrayBufferLike> {
  const candidate = file as unknown as { data?: () => ArrayBufferLike | Promise<ArrayBufferLike> };
  if (typeof candidate.data === "function") {
    const result = candidate.data();
    return result instanceof Promise ? await result : result;
  }
  throw new Error("DataTransferFile does not expose data()");
}
