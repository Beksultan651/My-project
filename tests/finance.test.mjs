import test from "node:test";
import assert from "node:assert/strict";
import { emptyData, goalProgress, MAX_MONEY, money, parseMoney, readData, totals, validDate } from "../lib/finance.ts";

test("теңге дәл бүтін тиынға айналады", () => {
  assert.equal(parseMoney("0.10"), 10);
  assert.equal(parseMoney("0,20"), 20);
  assert.equal(parseMoney("1250.05"), 125005);
  assert.equal(parseMoney(" 42 "), 4200);
  assert.equal(parseMoney("0"), 0);
  for (const invalid of ["", "-10", "NaN", "Infinity", "1e5", "0.001", "12,2.1", "1000000001"]) assert.equal(parseMoney(invalid), null, invalid);
});

const transaction = (id, type, amount) => ({ id, type, amount, title: "Сынақ", category: type === "income" ? "Жалақы" : "Көлік", date: "2026-10-20" });
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
  assert.equal(goalProgress({ target: 10000, saved: 2500 }), 25);
  assert.equal(goalProgress({ target: 10000, saved: 9999 }), 99);
  assert.equal(goalProgress({ target: 10000, saved: 10000 }), 100);
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
