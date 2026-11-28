import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { derive, dummySalt, SESSION_SECONDS, tokenHash, type FinanceUser } from "./finance-credentials.ts";
import { parseMoney } from "./finance.ts";
import { isFinanceData } from "./finance-storage.ts";
import type { FinanceData } from "../types/finance";
import type { Prisma, PrismaClient } from "./generated/prisma/client.ts";
import { getPrisma } from "./prisma.ts";

type DbTransaction = Prisma.TransactionClient;
type Owned = { userId: string; position: number };

function ordered<T, U>(userId: string, rows: T[], map: (row: T) => U): (U & Owned)[] {
  return rows.map((row, position) => ({ ...map(row), userId, position }));
}

export async function writeLedgerRows(tx: DbTransaction, userId: string, data: FinanceData) {
  // The caller holds the ledger row lock throughout the snapshot replacement.
  await tx.transaction.deleteMany({ where: { userId } });
  await tx.account.deleteMany({ where: { userId } });
  await tx.category.deleteMany({ where: { userId } });
  await tx.goal.deleteMany({ where: { userId } });
  await tx.account.createMany({ data: ordered(userId, data.accounts, ({ id, name, type, initialBalance, currency, createdAt }) => ({
    id, name, type, initialBalance: BigInt(initialBalance), currency, createdAt,
  })) });
  await tx.category.createMany({ data: ordered(userId, data.categories, ({ id, name, type }) => ({ id, name, type })) });
  await tx.transaction.createMany({ data: ordered(userId, data.transactions, ({ id, accountId, categoryId, type, amount, description, date, createdAt, updatedAt }) => ({
    id, accountId, categoryId, type, amount: BigInt(amount), description, date, createdAt, updatedAt,
  })) });
  await tx.goal.createMany({ data: ordered(userId, data.goals, ({ id, name, targetAmount, savedAmount, deadline, createdAt, updatedAt }) => ({
    id, name, targetAmount: BigInt(targetAmount), savedAmount: BigInt(savedAmount), deadline, createdAt, updatedAt,
  })) });
  const cents = (value: string) => {
    const parsed = parseMoney(value);
    return parsed === null ? null : BigInt(parsed);
  };
  const budget = {
    input: data.budget,
    income: cents(data.budget.income), housing: cents(data.budget.housing),
    food: cents(data.budget.food), transport: cents(data.budget.transport), other: cents(data.budget.other),
  };
  await tx.budget.upsert({ where: { userId }, create: { userId, ...budget }, update: budget });
}

async function createLedger(tx: DbTransaction, userId: string, data: FinanceData, revision = 1) {
  const result = await tx.ledger.createMany({
    data: { userId, revision, theme: data.theme, completedLessons: data.completedLessons },
    skipDuplicates: true,
  });
  if (result.count !== 1) return false;
  await writeLedgerRows(tx, userId, data);
  return true;
}

function unowned<T extends Owned>({ userId, position, ...row }: T) {
  void userId;
  void position;
  return row;
}

export class FinancePostgres {
  private readonly db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
  }

  async register(username: string, password: string) {
    const salt = randomBytes(16).toString("hex");
    const digest = await derive(password, salt);
    const id = randomUUID();
    const { count } = await this.db.user.createMany({
      data: { id, username, salt, hash: digest.toString("hex"), createdAt: new Date() }, skipDuplicates: true,
    });
    return count ? { id, username } : null;
  }

  async login(username: string, password: string): Promise<FinanceUser | null> {
    const row = await this.db.user.findUnique({ where: { username } });
    const digest = await derive(password, row?.salt ?? dummySalt);
    const expected = row ? Buffer.from(row.hash, "hex") : Buffer.alloc(64);
    return expected.length === digest.length && timingSafeEqual(digest, expected) && row
      ? { id: row.id, username: row.username } : null;
  }

  async createSession(userId: string) {
    const token = randomBytes(32).toString("base64url");
    const now = Date.now();
    const created = await this.db.$transaction(async tx => {
      const active = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM users WHERE id = ${userId} AND status = 'ACTIVE' FOR UPDATE`;
      if (!active.length) return false;
      await tx.session.create({ data: { tokenHash: tokenHash(token), userId, expires: BigInt(now + SESSION_SECONDS * 1000) } });
      return true;
    });
    if (!created) throw new Error("Inactive account");
    return token;
  }

  async session(token?: string): Promise<FinanceUser | null> {
    if (!token || !/^[\w-]{43}$/.test(token)) return null;
    const row = await this.db.session.findUnique({
      where: { tokenHash: tokenHash(token), expires: { gt: BigInt(Date.now()) }, user: { status: "ACTIVE" } },
      select: { user: { select: { id: true, username: true } } },
    });
    return row?.user ?? null;
  }

  async logout(token?: string) {
    if (token && /^[\w-]{43}$/.test(token)) {
      await this.db.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
    }
  }

  async read(userId: string): Promise<{ version: number; data: FinanceData | null }> {
    const orderBy = { position: "asc" } as const;
    const ledger = await this.db.$transaction(tx => tx.ledger.findUnique({
      where: { userId },
      include: { accounts: { orderBy }, categories: { orderBy }, transactions: { orderBy }, goals: { orderBy }, budget: true },
    }), { isolationLevel: "RepeatableRead" });
    if (!ledger) return { version: 0, data: null };

    const data = {
      version: 2,
      accounts: ledger.accounts.map(row => ({ ...unowned(row), initialBalance: Number(row.initialBalance) })),
      categories: ledger.categories.map(unowned),
      transactions: ledger.transactions.map(row => ({ ...unowned(row), amount: Number(row.amount) })),
      goals: ledger.goals.map(row => ({ ...unowned(row), targetAmount: Number(row.targetAmount), savedAmount: Number(row.savedAmount) })),
      completedLessons: ledger.completedLessons, theme: ledger.theme, budget: ledger.budget?.input,
    };
    if (!isFinanceData(data)) throw new Error("Invalid stored finance snapshot");
    return { version: ledger.revision, data };
  }

  async save(userId: string, revision: number, data: FinanceData) {
    return this.db.$transaction(async tx => {
      if (revision === 0) return createLedger(tx, userId, data);
      const result = await tx.ledger.updateMany({
        where: { userId, revision },
        data: { revision: { increment: 1 }, theme: data.theme, completedLessons: data.completedLessons },
      });
      if (result.count !== 1) return false;
      await writeLedgerRows(tx, userId, data);
      return true;
    }, { isolationLevel: "ReadCommitted", timeout: 30000 });
  }

  async importLegacy(userId: string, data: FinanceData) {
    const rejected = new Error("Legacy import conflict");
    try {
      return await this.db.$transaction(async tx => {
        const claim = await tx.legacyClaim.createMany({ data: { singleton: 1, userId }, skipDuplicates: true });
        if (!claim.count) return false;
        if (!(await createLedger(tx, userId, data))) throw rejected;
        return true;
      }, { timeout: 30000 });
    } catch (error) {
      if (error === rejected) return false;
      throw error;
    }
  }
}

export function getFinanceAccountDb() {
  return new FinancePostgres(getPrisma());
}
