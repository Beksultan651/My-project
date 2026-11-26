import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { FinanceAccountDb } from "../lib/finance-account-db.ts";
import { FinancePostgres } from "../lib/finance-postgres.ts";
import { createPrisma } from "../lib/prisma.ts";
import { newFinance } from "../lib/finance-storage.ts";

test("real PostgreSQL: account isolation, exact amounts, sessions, concurrent writes", async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, "Set TEST_DATABASE_URL to a migrated, dedicated test database");
  const db = createPrisma(url);
  const store = new FinancePostgres(db);
  const suffix = randomUUID();
  const names = [`a-${suffix}`, `b-${suffix}`];
  try {
    const password = "postgres-qa-fixture-password";
    const a = await store.register(names[0], password);
    const b = await store.register(names[1], password);
    assert.ok(a && b);
    assert.equal(await store.register(names[0], password), null);
    assert.equal(await store.login(names[0], "fixture-wrong-password"), null);
    assert.deepEqual(await store.login(names[0], password), a);
    const token = await store.createSession(a.id);
    assert.deepEqual(await store.session(token), a);

    const date = new Date().toISOString();
    const data = newFinance(date);
    data.accounts[0].initialBalance = 100_000_000_000;
    data.budget.income = "123,45";
    data.transactions.push({ id: "shared-record-id", accountId: data.accounts[0].id,
      categoryId: "salary", type: "income", amount: 12345, description: "QA",
      date: date.slice(0, 10), createdAt: date, updatedAt: date });
    assert.equal(await store.save(a.id, 0, data), true);
    assert.deepEqual(await store.read(a.id), { version: 1, data });
    assert.deepEqual(await store.read(b.id), { version: 0, data: null });
    assert.equal((await db.budget.findUniqueOrThrow({ where: { userId: a.id } })).income, 12345n);
    const competing = await Promise.all([store.save(a.id, 1, data), store.save(a.id, 1, { ...data, theme: "dark" })]);
    assert.equal(competing.filter(Boolean).length, 1);
    assert.equal((await store.read(a.id)).version, 2);
    const changed = { ...data, transactions: [{ ...data.transactions[0], accountId: "missing" }] };
    await assert.rejects(store.save(a.id, 2, changed));
    assert.equal((await store.read(a.id)).version, 2);
    assert.equal((await store.read(a.id)).data.transactions[0].accountId, data.accounts[0].id);
    assert.equal(await store.save(b.id, 0, { ...data, transactions: [] }), true);
    assert.equal((await store.read(b.id)).data.transactions.length, 0);
    await store.logout(token);
    assert.equal(await store.session(token), null);
  } finally {
    await db.user.deleteMany({ where: { username: { in: names } } });
    await db.$disconnect();
  }
});

test("real PostgreSQL: migrates the old SQLite ledger and rejects a second import", async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, "Set TEST_DATABASE_URL to a migrated, dedicated empty test database");
  const dir = await mkdtemp(join(tmpdir(), "qarjy-postgres-"));
  const filename = join(dir, "old.sqlite");
  const username = `source-${randomUUID()}`;
  const password = "fixture-old-sqlite-password";
  const data = newFinance(new Date().toISOString(), "dark");
  data.accounts[0].initialBalance = 12345;
  const db = createPrisma(url);
  const run = promisify(execFile);
  const importData = () => run(process.execPath, ["scripts/import-sqlite.ts", filename], {
    env: { ...process.env, DATABASE_URL: url },
  });
  try {
    assert.equal(await db.user.count(), 0, "The import test requires an empty database");
    const oldDb = new FinanceAccountDb(filename);
    let user;
    try {
      user = await oldDb.register(username, password);
      assert.ok(user);
      assert.equal(oldDb.importLegacy(user.id, data), true);
      assert.equal(oldDb.save(user.id, 1, data), true);
    } finally {
      oldDb.close();
    }
    const original = await readFile(filename);
    await importData();
    const store = new FinancePostgres(db);
    assert.deepEqual(await store.login(username, password), user);
    assert.deepEqual(await store.read(user.id), { version: 2, data });
    assert.equal((await db.legacyClaim.findUnique({ where: { singleton: 1 } })).userId, user.id);
    await assert.rejects(importData(), /Target must be empty/);
    assert.deepEqual(await store.read(user.id), { version: 2, data });
    assert.deepEqual(await readFile(filename), original);
  } finally {
    await db.legacyClaim.deleteMany({ where: { user: { username } } });
    await db.user.deleteMany({ where: { username } });
    await db.$disconnect();
    await rm(dir, { recursive: true, force: true });
  }
});
