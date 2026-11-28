import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createPrisma } from "../lib/prisma.ts";
import { FinancePostgres } from "../lib/finance-postgres.ts";

// Run against a local app configured with the same isolated TEST_DATABASE_URL.
test("supervision permission, virtual grants, audit trail and conversations", async () => {
  const url = process.env.TEST_DATABASE_URL,
    origin = process.env.TEST_APP_ORIGIN;
  assert.ok(url && origin && new URL(origin).hostname === "127.0.0.1");
  const db = createPrisma(url),
    store = new FinancePostgres(db),
    ids = [];
  async function fixture(isAdmin) {
    const user = await store.register("qa-" + randomUUID(), randomUUID());
    ids.push(user.id);
    if (isAdmin)
      await db.user.update({ where: { id: user.id }, data: { isAdmin } });
    return { ...user, token: await store.createSession(user.id) };
  }
  async function call(user, body) {
    const response = await fetch(origin + "/api/supervision", {
      method: body ? "POST" : "GET",
      headers: {
        origin,
        cookie: user ? "qarjy_account=" + user.token : "",
        "content-type": "application/json",
      },
      body: body && JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  }
  try {
    const admin = await fixture(true),
      user = await fixture(false),
      other = await fixture(false);
    assert.equal((await call(null)).status, 401);
    const grant = {
      action: "grant",
      peer: user.id,
      key: randomUUID(),
      date: "2026-11-26",
      note: "Fixture",
      amount: "125.75",
    };
    assert.equal((await call(admin, grant)).status, 403);
    assert.equal(
      (await call(user, { action: "permission", peer: admin.id, active: true }))
        .status,
      200,
    );
    assert.deepEqual(
      (await Promise.all([call(admin, grant), call(admin, grant)]))
        .map((r) => r.status)
        .sort(),
      [200, 201],
    );
    assert.equal((await call(admin, { ...grant, amount: "99" })).status, 409);
    assert.equal((await call(user)).data.rows[0].grants[0].amount, 12575);
    assert.equal((await call(other)).data.rows[0].grants.length, 0);
    assert.equal(
      (
        await call(admin, {
          action: "message",
          peer: user.id,
          note: "Hello",
          advice: true,
        })
      ).status,
      201,
    );
    assert.equal((await call(user)).data.messages[0].readAt, null);
    assert.equal(
      (await call(user, { action: "read", peer: admin.id })).status,
      200,
    );
    assert.ok((await call(admin)).data.messages[0].readAt);
    assert.equal(
      (await call(user, { action: "message", peer: admin.id, note: "Reply" }))
        .status,
      201,
    );
    assert.equal((await call(other)).data.messages.length, 0);
    assert.equal(
      (
        await call(user, {
          action: "permission",
          peer: admin.id,
          active: false,
        })
      ).status,
      200,
    );
    assert.equal((await call(admin)).data.rows.length, 0);
    assert.equal((await call(admin, grant)).status, 403);
    assert.equal(
      await db.adminEvent.count({
        where: { actor: admin.id, action: "grant" },
      }),
      1,
    );
  } finally {
    const where = { studentId: { in: ids } };
    await db.adminEvent.deleteMany({ where: { student: { in: ids } } });
    await db.coachMessage.deleteMany({ where });
    await db.virtualGrant.deleteMany({ where });
    await db.supervision.deleteMany({ where });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
