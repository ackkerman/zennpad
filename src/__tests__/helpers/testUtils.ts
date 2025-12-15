import Module from "node:module";

type ModuleLoader = (
  request: string,
  parent: NodeModule | null | undefined,
  isMain: boolean
) => unknown;

interface ModuleWithLoad {
  _load: ModuleLoader;
}

export async function withMockedVscode<T>(
  factory: () => Promise<T>,
  stub: unknown = {}
): Promise<T> {
  const moduleWithLoad = Module as unknown as ModuleWithLoad;
  const originalLoad = moduleWithLoad._load;

  moduleWithLoad._load = function mockLoad(request, parent, isMain) {
    if (request === "vscode") {
      return stub;
    }
    return originalLoad(request, parent, isMain);
  };

  try {
    return await factory();
  } finally {
    moduleWithLoad._load = originalLoad;
  }
}

export function createVscodeStub() {
  class Uri {
    constructor(
      public readonly scheme: string,
      public readonly path: string
    ) {}
    static from(init: { scheme: string; path: string }): Uri {
      return new Uri(init.scheme, init.path);
    }
  }

  class Disposable {
    constructor(private readonly disposer?: () => void) {}
    dispose(): void {
      this.disposer?.();
    }
  }

  class EventEmitter<T> {
    private listeners: Array<(event: T) => void> = [];
    event = (listener: (event: T) => void): Disposable => {
      this.listeners.push(listener);
      return new Disposable(() => {
        this.listeners = this.listeners.filter((l) => l !== listener);
      });
    };
    fire(event: T): void {
      for (const listener of [...this.listeners]) {
        listener(event);
      }
    }
  }

  const FileType = {
    File: 1,
    Directory: 2
  } as const;

  const FileChangeType = {
    Created: 1,
    Changed: 2,
    Deleted: 3
  } as const;

  const FileSystemError = {
    FileNotFound: (uri: Uri) =>
      Object.assign(new Error(`File not found: ${uri.path}`), { code: "FileNotFound" }),
    FileExists: (uri: Uri) => Object.assign(new Error(`File exists: ${uri.path}`), { code: "FileExists" }),
    NoPermissions: (message: string) => Object.assign(new Error(message), { code: "NoPermissions" })
  };

  return {
    Uri,
    Disposable,
    EventEmitter,
    FileType,
    FileChangeType,
    FileSystemError
  };
}
