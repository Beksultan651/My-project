import { readFile } from "node:fs/promises";
import path from "node:path";
import { decodeFinance } from "./finance-storage.ts";

export const serverFinancePath = path.resolve(/*turbopackIgnore: true*/ process.env.QARJY_LEGACY_PATH || "data/finance.json");

export async function readServerFinance(filename = serverFinancePath) {
  try {
    const source = await readFile(/*turbopackIgnore: true*/ filename, "utf8");
    return decodeFinance(source, new Date().toISOString());
  } catch {
    return null;
  }
}
