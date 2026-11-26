import nextEnv from "@next/env";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isFinanceData } from "../lib/finance-storage.ts";
import { writeLedgerRows } from "../lib/finance-postgres.ts";
import { createPrisma } from "../lib/prisma.ts";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.DATABASE_URL;
if (!url || !process.argv[2]) throw new Error("DATABASE_URL and an explicit source SQLite path are required.");
const source = new DatabaseSync(resolve(process.argv[2]), { readOnly: true });
const database = createPrisma(url);
try {
  source.exec("BEGIN");
  const users = source.prepare("SELECT id, username, salt, hash FROM users").all().map(row => ({
    id: String(row.id), username: String(row.username), salt: String(row.salt), hash: String(row.hash),
  }));
  const finances = source.prepare("SELECT user_id, version, payload FROM finances").all().map(row => {
    const data: unknown = JSON.parse(String(row.payload));
    if (!isFinanceData(data)) throw new Error("Invalid snapshot in the SQLite source.");
    const revision = Number(row.version);
    if (!Number.isInteger(revision) || revision < 1 || revision > 2147483647) throw new Error("Invalid source revision.");
    return { userId: String(row.user_id), revision, data };
  });
  const claims = source.prepare("SELECT singleton, user_id FROM legacy_claim").all().map(row => ({
    singleton: Number(row.singleton), userId: String(row.user_id),
  }));
  source.exec("COMMIT");

  await database.$transaction(async tx => {
    const schema = new URL(url).searchParams.get("schema") ?? "public";
    await tx.$queryRaw`SELECT set_config('search_path', quote_ident(${schema}), true)`;
    await tx.$executeRaw`LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE`;
    if (await tx.user.count()) throw new Error("Target must be empty. Existing PostgreSQL data was not changed.");
    if (users.length) await tx.user.createMany({ data: users });
    for (const { userId, revision, data } of finances) {
      await tx.ledger.create({ data: { userId, revision, theme: data.theme, completedLessons: data.completedLessons } });
      await writeLedgerRows(tx, userId, data);
    }
    if (claims.length) await tx.legacyClaim.createMany({ data: claims });
  }, { timeout: 120000 });
  console.log(`Imported ${users.length} accounts and ${finances.length} ledgers. Users can sign in with their existing passwords.`);
} finally {
  source.close();
  await database.$disconnect();
}
