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
