import test from "node:test";
import assert from "node:assert/strict";
import { displayDate, emptyData, goalProgress, MAX_MONEY, money, MONTH_LABELS, parseMoney, readData, totals, validDate } from "../lib/finance.ts";
import { filterTransactions } from "../lib/transactions.ts";
import { createRecordId } from "../lib/record-id.ts";

test("native UUID қолжетімді болса, жазба ID-і дұрыс алынады", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  assert.equal(createRecordId({ randomUUID: () => id }), id);
});

test("HTTP ортасында randomUUID болмаса да UUID жасалады", () => {
  const id = createRecordId({ getRandomValues: (bytes) => { bytes.forEach((_, index) => { bytes[index] = index; }); return bytes; } });
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("Crypto мүлдем жоқ болса, жергілікті ID-лер қайталанбайды", () => {
  const ids = Array.from({ length: 1000 }, () => createRecordId({}));
  assert.equal(new Set(ids).size, 1000);
  assert.ok(ids.every((id) => id.length > 0 && id.length <= 100));
});

test("Crypto әдістері қате шығарса, жазба қосу ID қатесімен тоқтамайды", () => {
  const unavailable = () => { throw new Error("Unavailable"); };
  const id = createRecordId({ randomUUID: unavailable, getRandomValues: unavailable });
  assert.match(id, /^local-/);
});

test("теңге дәл бүтін тиынға айналады", () => {
  assert.equal(parseMoney("0.10"), 10);
  assert.equal(parseMoney("0,20"), 20);
  assert.equal(parseMoney("1250.05"), 125005);
  assert.equal(parseMoney(" 42 "), 4200);
  assert.equal(parseMoney("0"), 0);
  for (const invalid of ["", "-10", "NaN", "Infinity", "1e5", "0.001", "12,2.1", "1000000001"]) assert.equal(parseMoney(invalid), null, invalid);
});

const transaction = (id, type, amount) => ({ id, type, amount, title: "Сынақ", category: type === "income" ? "Жалақы" : "Көлік", date: "2026-10-20" });

test("ай атаулары браузер локаліне тәуелсіз қазақша көрсетіледі", () => {
  assert.equal(displayDate("2026-11-03", true), "3 қараша 2026");
  assert.equal(displayDate("2026-11-03"), "3 қар.");
  assert.equal(displayDate("invalid", true), "—");
  assert.equal(MONTH_LABELS.length, 12);
  assert.equal(MONTH_LABELS[5], "Мау");
});
test("теңге браузер тіліне тәуелсіз бірдей пішімделеді", () => {
  assert.equal(money(125005), "1\u00a0250,05 ₸");
  assert.equal(money(30000050), "300\u00a0000,50 ₸");
  assert.equal(money(-1050), "−10,50 ₸");
  assert.equal(money(0), "0 ₸");
});
test("кіріс, шығыс және баланс дөңгелектеу қатесінсіз есептеледі", () => {
  assert.deepEqual(totals([]), { income: 0, expense: 0, balance: 0 });
  assert.deepEqual(totals([transaction("a", "income", parseMoney("0.30")), transaction("b", "expense", parseMoney("0.10")), transaction("c", "expense", parseMoney("0.20"))]), { income: 30, expense: 30, balance: 0 });
  assert.equal(totals([transaction("a", "expense", 100)]).balance, -100);
  assert.ok(Number.isSafeInteger(MAX_MONEY * 10000));
});

test("мақсат 100 пайызды тек толық жиналғанда көрсетеді", () => {
  assert.equal(goalProgress({ targetAmount: 10000, savedAmount: 2500 }), 25);
  assert.equal(goalProgress({ targetAmount: 10000, savedAmount: 9999 }), 99);
  assert.equal(goalProgress({ targetAmount: 10000, savedAmount: 10000 }), 100);
});

test("нақты күндерді ғана қабылдайды", () => {
  assert.equal(validDate("2024-02-29"), true);
  for (const invalid of ["2026-02-29", "2026-02-30", "2026-13-01", "20.10.2026", "bad"]) assert.equal(validDate(invalid), false);
});

test("дұрыс localStorage деректерін жоғалтпай оқиды", () => {
  const value = { ...emptyData, transactions: [transaction("a", "income", 30000)], goals: [{ id: "goal", title: "Ноутбук", saved: 100, target: 500, deadline: "" }], completedLessons: ["lesson-1"], theme: "dark", budget: { ...emptyData.budget, income: "300,50" } };
  assert.deepEqual(readData(JSON.stringify(value)), value);
});

test("бұзылған немесе қате деректерді қабылдамайды", () => {
  const values = [null, [], { ...emptyData, version: 2 }, { ...emptyData, transactions: [transaction("a", "income", -1)] }, { ...emptyData, transactions: [transaction("a", "income", .5)] }, { ...emptyData, transactions: [{ ...transaction("a", "income", 100), category: "Көлік" }] }, { ...emptyData, transactions: [transaction("a", "income", 10), transaction("a", "income", 20)] }, { ...emptyData, goals: [{ id: "g", title: "Сынақ", target: 100, saved: 101, deadline: "" }] }, { ...emptyData, theme: "other" }, { ...emptyData, completedLessons: ["lesson-999"] }, { ...emptyData, budget: { ...emptyData.budget, income: "-5" } }];
  for (const value of values) assert.equal(readData(JSON.stringify(value)), null);
  assert.equal(readData("{broken"), null);
});

test("сүзгілер бірге қолданылады және бастапқы тізім өзгермейді", () => {
  const original = [
    { ...transaction("old", "expense", 100), title: "Автобус", date: "2026-09-10" },
    { ...transaction("new", "expense", 300), title: "Автобус", date: "2026-10-20" },
    transaction("salary", "income", 500),
  ];
  const records = original.map((item) => ({ ...item, description: item.title, categoryId: item.category }));
  const before = structuredClone(records);
  const result = filterTransactions(records, { query: "  АВТОБУС ", type: "expense", month: "2026-10", category: "Көлік" });
  assert.deepEqual(result.map((t) => t.id), ["new"]);
  assert.deepEqual(filterTransactions(records, { query: "табылмайды" }), []);
  assert.deepEqual(records, before);
});

test("сома және күн бойынша сұрыптау дұрыс жұмыс істейді", () => {
  const items = [
    { ...transaction("a", "income", 500), date: "2026-09-01" },
    { ...transaction("b", "expense", 100), date: "2026-10-20" },
    { ...transaction("c", "expense", 300), date: "2026-10-10" },
  ];
  const ids = (sort) => filterTransactions(items, { sort }).map((t) => t.id);
  assert.deepEqual(ids("newest"), ["b", "c", "a"]);
  assert.deepEqual(ids("oldest"), ["a", "c", "b"]);
  assert.deepEqual(ids("amount-desc"), ["a", "c", "b"]);
  assert.deepEqual(ids("amount-asc"), ["b", "c", "a"]);
});
