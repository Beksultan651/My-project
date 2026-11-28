import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { FinancePostgres } from "../lib/finance-postgres.ts";
import { createPrisma } from "../lib/prisma.ts";

test("learning profiles, task CRUD, ownership and completion", async () => {
  const url = process.env.TEST_DATABASE_URL;
  const origin = process.env.TEST_APP_ORIGIN;
  assert.equal(new URL(url).hostname, "127.0.0.1");
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  const db = createPrisma(url);
  const store = new FinancePostgres(db);
  const ids = [];

  async function fixture(isAdmin) {
    const user = await store.register("qa-" + randomUUID(), randomUUID());
    ids.push(user.id);
    if (isAdmin) await db.user.update({ where: { id: user.id }, data: { isAdmin } });
    return { ...user, token: await store.createSession(user.id) };
  }

  async function request(user, method = "GET", body) {
    const response = await fetch(origin + "/api/learning-tasks", {
      method, headers: { origin, cookie: user ? "qarjy_account=" + user.token : "", "content-type": "application/json" },
      body: body && JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  }

  try {
    const admin = await fixture(true);
    const reviewer = await fixture(true);
    const learner = await fixture(false);
    const other = await fixture(false);
    assert.equal((await request(null)).status, 401);
    assert.equal((await request(learner, "POST", { action: "demo" })).status, 403);
    assert.deepEqual((await Promise.all([request(admin, "POST", { action: "demo" }), request(admin, "POST", { action: "demo" })])).map((r) => r.status).sort(), [200, 201]);
    const first = (await request(admin)).data;
    assert.ok(first.demo);
    assert.equal(first.tasks.length, 3);
    const person = first.people.find(({ id }) => id === learner.id);
    assert.ok(person);
    assert.equal("email" in person, false);
    assert.equal("ledger" in person, false);
    assert.equal((await request(reviewer)).data.demo, null);

    const draft = { body: "Create a savings plan", assigneeId: learner.id, completed: false };
    const created = await request(admin, "POST", draft);
    assert.equal(created.status, 201);
    const { id } = created.data;
    assert.equal((await request(other, "PATCH", { action: "complete", id, completed: true })).status, 404);
    assert.equal((await request(reviewer, "DELETE", { id })).status, 404);
    assert.equal((await request(other)).data.tasks.length, 0);
    assert.equal((await request(learner)).data.tasks[0].body, draft.body);
    assert.equal((await request(learner, "PATCH", { action: "complete", id, completed: true })).status, 200);
    assert.equal((await db.learningTask.findUnique({ where: { id } })).completed, true);
    assert.equal((await request(admin, "PATCH", { ...draft, id, body: "Edit the plan" })).status, 200);
    assert.equal((await request(learner)).data.tasks[0].body, "Edit the plan");
    assert.equal((await request(admin, "DELETE", { id })).status, 200);
    assert.equal((await request(learner)).data.tasks.length, 0);
    assert.equal(await db.adminEvent.count({ where: { actor: admin.id, action: "learning.task.delete", reference: id } }), 1);
  } finally {
    await db.adminEvent.deleteMany({ where: { actor: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
