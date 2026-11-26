declare module "node:sqlite" {
  type Value = string | number | bigint | Uint8Array | null;
  interface Statement {
    get(...values: Value[]): Record<string, unknown> | undefined;
    all(...values: Value[]): Record<string, unknown>[];
    run(...values: Value[]): { changes: number | bigint };
  }
  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean });
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
  }
}
