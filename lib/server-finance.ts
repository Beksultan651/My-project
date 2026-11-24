import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FinanceData } from "../types/finance";
import { isFinanceData } from "./finance-storage.ts";

const dataDirectory = path.join(process.cwd(), "data");
export const serverFinancePath = path.join(dataDirectory, "finance.json");

let writeQueue: Promise<void> = Promise.resolve();

function queueMutation(operation: () => Promise<void>): Promise<void> {
  const queued = writeQueue.catch(() => undefined).then(operation);
  writeQueue = queued.catch(() => undefined);
  return queued;
}

export async function readServerFinance(filePath = serverFinancePath): Promise<FinanceData | null> {
  try {
    const raw = await readFile(/*turbopackIgnore: true*/ filePath, "utf8");
    const value: unknown = JSON.parse(raw);
    return isFinanceData(value) ? value : null;
  } catch {
    return null;
  }
}

export async function writeServerFinance(
  data: FinanceData,
  filePath = serverFinancePath,
): Promise<boolean> {
  if (!isFinanceData(data)) return false;

  await queueMutation(async () => {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(data, null, 2), "utf8");
    await rename(temporaryPath, filePath);
  });
  return true;
}

export async function deleteServerFinance(filePath = serverFinancePath): Promise<boolean> {
  try {
    await queueMutation(async () => {
      await rm(filePath, { force: true });
    });
    return true;
  } catch {
    return false;
  }
}
