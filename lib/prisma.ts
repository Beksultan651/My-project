import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

export function createPrisma(url: string) {
  const schema = new URL(url).searchParams.get("schema") ?? "public";
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 5000 }, { schema }) });
}

const runtime = globalThis as typeof globalThis & { qarjyPrisma?: PrismaClient };

export function getPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return runtime.qarjyPrisma ??= createPrisma(url);
}
