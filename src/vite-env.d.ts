interface ImportMeta {
  readonly hot?: {
    readonly data: unknown;
    accept(): void;
    accept(cb: (mod: unknown) => void): void;
    accept(dep: string, cb: (mod: unknown) => void): void;
    accept(deps: readonly string[], cb: (mods: unknown[]) => void): void;
    dispose(cb: (data: unknown) => void): void;
    prune(cb: () => void): void;
    invalidate(message?: string): void;
    on<T = unknown>(event: string, cb: (payload: T) => void): void;
    send<T = unknown>(event: string, data?: T): void;
  };
}

declare module "*.css?raw" {
  const content: string;
  export default content;
}
