import assert from "node:assert/strict";
import test from "node:test";
import { emptyData, goalProgress, STORAGE_KEY, totals } from "../lib/finance.ts";
import { applyFinanceAction, currencyLedger } from "../lib/finance-records.ts";
import { commitFinance, decodeFinance, defaultAccountId, isFinanceData, newFinance } from "../lib/finance-storage.ts";
import { readServerFinance } from "../lib/server-finance.ts";
import { allowAttempt, sameOrigin, sessionCookie } from "../lib/finance-http.ts";
import { mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

const now = "2026-11-16T12:00:00.000Z";
const fallback = newFinance(now);
const checking = { id: "checking", name: "Карта", type: "card", currency: "KZT", initialBalance: 250000, createdAt: now };
const salary = {
  id: "salary-record", accountId: checking.id, categoryId: "salary", type: "income", amount: 1000000,
  description: "Айлық", date: "2026-11-15", createdAt: now, updatedAt: now,
};
const goal = {
  id: "goal", name: "Жинақ", targetAmount: 50000, savedAmount: 10000,
  deadline: "", createdAt: now, updatedAt: now,
};

function storageWith(raw = null) {
  let value = raw;
  return {
    getItem(key) { assert.equal(key, STORAGE_KEY); return value; },
    setItem(key, next) { assert.equal(key, STORAGE_KEY); value = next; },
  };
}

function save(storage, action, initial = fallback) {
  return commitFinance(storage, initial, now, (data) => applyFinanceAction(data, action));
}

function ok(result) {
  assert.ok("data" in result, JSON.stringify(result));
  assert.equal(isFinanceData(result.data), true);
  return result.data;
}

test("V1 JSON көшірілгенде жазбалар, бюджет, тақырып және сабақтар сақталады", () => {
  const legacy = {
    ...emptyData, theme: "dark", completedLessons: ["lesson-2"], budget: { ...emptyData.budget, income: "1000,50" },
    transactions: [{ id: "old", type: "expense", title: "Жол", date: "2026-10-10", category: "Көлік", amount: 30000 }],
    goals: [{ id: "old-goal", title: "Жолға", target: 100000, saved: 5000, deadline: "2026-01-01" }],
  };
  const storage = storageWith(JSON.stringify(legacy));
  const migrated = decodeFinance(storage.getItem(STORAGE_KEY), now);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.transactions[0].accountId, defaultAccountId);
  assert.equal(migrated.transactions[0].categoryId, "transport");
  assert.equal(migrated.transactions[0].description, "Жол");
  assert.equal(migrated.goals[0].deadline, "2026-01-01");
  assert.equal(goalProgress(migrated.goals[0]), 5);
  const updated = ok(save(storage, { collection: "accounts", next: checking }));
  assert.deepEqual(updated.transactions, migrated.transactions);
  assert.deepEqual(updated.goals, migrated.goals);
  assert.deepEqual(updated.completedLessons, legacy.completedLessons);
  assert.deepEqual(updated.budget, legacy.budget);
  assert.equal(updated.theme, "dark");
  assert.deepEqual(decodeFinance(storage.getItem(STORAGE_KEY), now), updated);
});

test("транзакция қосу, шотқа ауыстыру, түрін өзгерту және өшіру балансты қайта есептейді", () => {
  const storage = storageWith();
  ok(save(storage, { collection: "accounts", next: checking }));
  const getBalance = (data) => {
    const ledger = currencyLedger(data, "KZT");
    return totals(ledger.transactions, ledger.initialBalance);
  };
  let data = ok(save(storage, { collection: "transactions", next: salary }));
  assert.deepEqual(getBalance(data), { income: 1000000, expense: 0, balance: 1250000 });
  const expense = { ...salary, type: "expense", accountId: defaultAccountId, categoryId: "food", amount: 30000 };
  data = ok(save(storage, { collection: "transactions", previous: salary, next: expense }));
  assert.deepEqual(getBalance(data), { income: 0, expense: 30000, balance: 220000 });
  assert.equal(data.transactions[0].id, salary.id);
  data = ok(save(storage, { collection: "transactions", previous: expense, next: null }));
  assert.equal(getBalance(data).balance, 250000);
  assert.deepEqual(decodeFinance(storage.getItem(STORAGE_KEY), now), data);
});

test("шот валютасы мен санат түрін қолданылғанда өзгертуге немесе өшіруге болмайды", () => {
  const storage = storageWith();
  ok(save(storage, { collection: "accounts", next: checking }));
  const data = ok(save(storage, { collection: "transactions", next: salary }));
  const category = data.categories.find(({ id }) => id === salary.categoryId);
  const before = storage.getItem(STORAGE_KEY);
  for (const next of [null, { ...checking, currency: "USD" }]) {
    assert.equal(save(storage, { collection: "accounts", previous: checking, next }).error, "accountInUse");
  }
  for (const next of [null, { ...category, type: "expense" }]) {
    assert.equal(save(storage, { collection: "categories", previous: category, next }).error, "categoryInUse");
  }
  assert.equal(save(storage, { collection: "transactions", next: { ...salary, accountId: "missing" } }).error, "accountRequired");
  assert.equal(save(storage, { collection: "transactions", next: { ...salary, categoryId: "food" } }).error, "categoryRequired");
  assert.equal(storage.getItem(STORAGE_KEY), before);
  const renamed = { ...category, name: "Ай сайынғы кіріс" };
  const edited = ok(save(storage, { collection: "categories", previous: category, next: renamed }));
  assert.equal(edited.transactions[0].categoryId, renamed.id);
});

test("шотты жаңарту, валюталарды бөлу, жинақты өңдеу және пайдаланылмаған жазбаларды өшіру", () => {
  const storage = storageWith();
  ok(save(storage, { collection: "accounts", next: checking }));
  const usd = { ...checking, name: "USD шоты", initialBalance: 12550, currency: "USD" };
  const data = ok(save(storage, { collection: "accounts", previous: checking, next: usd }));
  assert.equal(currencyLedger(data, "USD").initialBalance, 12550);
  assert.equal(currencyLedger(data, "KZT").initialBalance, 0);
  ok(save(storage, { collection: "goals", next: goal }));
  const updated = { ...goal, name: "Жаңа мақсат", targetAmount: 40000, savedAmount: 15000 };
  assert.equal(goalProgress(ok(save(storage, { collection: "goals", previous: goal, next: updated })).goals[0]), 37);
  assert.equal(ok(save(storage, { collection: "goals", previous: updated, next: null })).goals.length, 0);
  assert.equal(ok(save(storage, { collection: "accounts", previous: usd, next: null })).accounts.length, 1);
  const category = { id: "custom", name: "Ойын", type: "expense" };
  ok(save(storage, { collection: "categories", next: category }));
  assert.equal(ok(save(storage, { collection: "categories", previous: category, next: null })).categories.some(({ id }) => id === category.id), false);
});

test("екінші қойындыдағы өзгеріс жоғалмайды, ескірген өңдеу кері қайтарылады", () => {
  const storage = storageWith();
  const before = ok(save(storage, { collection: "accounts", next: checking }));
  const newer = { ...checking, name: "Жаңартылған шот" };
  ok(save(storage, { collection: "accounts", previous: checking, next: newer }));
  const merged = ok(save(storage, { collection: "goals", next: goal }, before));
  assert.equal(merged.accounts.find((item) => item.id === checking.id).name, newer.name);
  assert.equal(save(storage, { collection: "accounts", previous: checking, next: null }, before).error, "recordChanged");
});

test("жарамсыз, кейінгі нұсқалы немесе сақтауға тыйым салынған JSON үстінен жазылмайды", () => {
  for (const raw of ["", "{bad", '{"version":3}', JSON.stringify({ ...fallback, transactions: [salary] })]) {
    const storage = storageWith(raw);
    assert.equal(save(storage, { collection: "goals", next: goal }).error, "storageInvalid");
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
  const blocked = { getItem() { throw Error("blocked"); }, setItem() { assert.fail("must not write"); } };
  assert.equal(save(blocked, { collection: "goals", next: goal }).error, "storageBlocked");
  const quota = { getItem() { return null; }, setItem() { throw Error("quota"); } };
  assert.equal(save(quota, { collection: "goals", next: goal }).error, "storageSave");
  const storage = storageWith();
  assert.equal(save(storage, { collection: "accounts", next: { ...checking, initialBalance: -1 } }).error, "formInvalid");
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("бұрынғы сервер JSON дерегі оқылады", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "qarjy-"));
  const file = path.join(directory, "finance.json");
  try {
    assert.equal(await readServerFinance(file), null);
    await writeFile(file, JSON.stringify(fallback));
    assert.deepEqual(await readServerFinance(file), fallback);
    await writeFile(file, "{broken");
    assert.equal(await readServerFinance(file), null);
  } finally {
    await unlink(file).catch(() => {});
    await rmdir(directory);
  }
});

test("сұраулар тек өз мекенжайынан қабылданады және HTTPS cookie қорғалады", () => {
  const first = new Request("https://finance.example/api/finance", { headers: { origin: "https://finance.example" } });
  assert.equal(sameOrigin(first), true);
  assert.equal(sameOrigin(new Request(first.url, { headers: { origin: "https://other.example" } })), false);
  assert.match(sessionCookie(first, "example"), /HttpOnly; SameSite=Strict; Max-Age=86400; Secure$/);
  assert.match(sessionCookie(first), /Max-Age=0; Secure$/);
});

test("кіру әрекеттерінің саны шектеледі", () => {
  const key = crypto.randomUUID();
  assert.equal(allowAttempt(key, 2), true);
  assert.equal(allowAttempt(key, 2), true);
  assert.equal(allowAttempt(key, 2), false);
});
