import fs from "node:fs";
import { createRequire } from "node:module";
import { Database, type Connection, type ParamValue, RelateError } from "@relate/relate";
import { DATA_DIR, STORE_PATH } from "./paths.js";

const require = createRequire(import.meta.url);
const { version: RELATE_PKG_VERSION } = require("@relate/relate/package.json") as {
  version: string;
};

export { RelateError, RELATE_PKG_VERSION };
export type { Connection, ParamValue };

/** Cypher parameter map accepted by Relate's query(). */
export type Params = { [name: string]: ParamValue };

/**
 * A result row. Shape is fixed by each query's RETURN clause (nodes, scalars, lists),
 * so callers read fields by name.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GraphRow = Record<string, any>;

export function queryRows(conn: Connection, cypher: string, params: Params = {}): GraphRow[] {
  return conn.query(cypher, params).rows as GraphRow[];
}

export function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function openStore(options?: { readOnly?: boolean; fresh?: boolean }): Connection {
  ensureDataDir();
  if (options?.fresh && fs.existsSync(STORE_PATH)) {
    fs.rmSync(STORE_PATH);
  }
  const db = Database.open(STORE_PATH, options?.readOnly ? { readOnly: true } : undefined);
  return db.connect();
}

export function storeExists(): boolean {
  return fs.existsSync(STORE_PATH);
}

export function vectorLiteral(values: number[]): string {
  const formatted = values.map((v) => v.toFixed(6)).join(", ");
  return `vector([${formatted}], ${values.length}, FLOAT32)`;
}