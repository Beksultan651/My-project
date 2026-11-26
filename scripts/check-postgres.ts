import nextEnv from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import type { TLSSocket } from "node:tls";
import { getPrisma } from "../lib/prisma.ts";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const db = getPrisma();
const transport = await new PrismaPg({ connectionString: url, connectionTimeoutMillis: 10000 }).connect();
try {
  const connection = await transport.underlyingDriver().connect();
  let tls = false;
  try {
    // Neon terminates TLS at its proxy, so pg_stat_ssl describes a different hop.
    const socket = (connection as unknown as { connection: { stream: TLSSocket } }).connection.stream;
    tls = socket.encrypted === true && socket.authorized === true;
    if (new URL(url).hostname.endsWith(".neon.tech") && !tls) {
      throw new Error("A verified TLS connection is required for Neon");
    }
  } finally {
    connection.release();
  }
  const status = await db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const [server] = await tx.$queryRaw<{ version: string; readOnly: boolean }[]>`
      SELECT version() AS version,
        current_setting('transaction_read_only') = 'on' AS "readOnly"
    `;
    if (!server?.readOnly) throw new Error("Read-only verification failed");
    const checks = [() => tx.user.count(), () => tx.session.count(), () => tx.ledger.count(),
      () => tx.account.count(), () => tx.category.count(), () => tx.transaction.count(),
      () => tx.goal.count(), () => tx.budget.count(), () => tx.legacyClaim.count()];
    for (const check of checks) await check();
    return server;
  }, { timeout: 30000 });
  console.log("PostgreSQL connection: OK");
  console.log(`Server: ${status.version}`);
  console.log(`TLS: ${tls ? "encrypted; certificate verified" : "not enabled (local connection)"}`);
  console.log("Transaction: read-only");
  console.log("Prisma models: 9/9 readable; no application data written");
} catch (error) {
  console.error("PostgreSQL check failed:", error instanceof Error ? error.name : "UnknownError");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
  await transport.dispose();
}
