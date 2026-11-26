import test from "node:test";
import assert from "node:assert/strict";
import { FinanceAccountDb } from "../lib/finance-account-db.ts";
import { newFinance } from "../lib/finance-storage.ts";

test("account authentication, isolated records, stale writes and logout", async () => {
  const db = new FinanceAccountDb(":memory:");
  try {
    const alpha = await db.register("tester-a", "sample-only-password-1");
    const beta = await db.register("tester-b", "sample-only-password-2");
    assert.ok(alpha && beta);
    assert.equal(await db.register("tester-a", "sample-only-password-1"), null);
    assert.equal(await db.login("tester-a", "sample-wrong-password"), null);
    assert.deepEqual(await db.login("tester-a", "sample-only-password-1"), alpha);
    const token = db.createSession(alpha.id);
    assert.deepEqual(db.session(token), alpha);

    const data = newFinance(new Date().toISOString());
    data.accounts[0].initialBalance = 10000;
    assert.equal(db.save(alpha.id, 0, data), true);
    assert.equal(db.save(alpha.id, 0, { ...data, theme: "dark" }), false);
    assert.deepEqual(db.read(alpha.id), { version: 1, data });
    assert.deepEqual(db.read(beta.id), { version: 0, data: null });
    assert.equal(db.importLegacy(alpha.id, data), false);
    assert.equal(db.importLegacy(beta.id, data), true);

    db.logout(token);
    assert.equal(db.session(token), null);
  } finally {
    db.close();
  }
});
