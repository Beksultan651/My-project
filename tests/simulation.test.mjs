import test from "node:test";
import assert from "node:assert/strict";
import { deposit, investmentScenario } from "../lib/simulation.ts";
import { savingsPlan } from "../lib/savings-plan.ts";

test("deposit compounds monthly and adds contributions at month end", () => {
  assert.deepEqual(deposit(10000, 1000, 12, 0, 2),
    { balance: 12211, history: [10000, 11100, 12211], interest: 211, purchasingPower: 12211 });
});
test("inflation reduces purchasing power and invalid inputs are rejected", () => {
  assert.equal(deposit(12000, 0, 0, 20, 12).purchasingPower, 10000);
  assert.equal(deposit(-1, 0, 5, 5, 12), null);
  assert.equal(deposit(1, 0, 5, Infinity, 12), null);
  assert.equal(deposit(1, 0, 0, 0, 121), null);
});

test("synthetic investing compares upside, downside and contributed cash", () => {
  const initial = 10_000_000, monthly = 500_000, months = 12;
  const positive = investmentScenario(initial, monthly, 60, months, "positive");
  const neutral = investmentScenario(initial, monthly, 60, months, "neutral");
  const negative = investmentScenario(initial, monthly, 60, months, "negative");
  assert.equal(positive.paid, initial + monthly * months);
  assert.equal(positive.balance, positive.stocks + positive.bonds);
  assert.equal(positive.history.length, months + 1);
  assert.ok(positive.profit > neutral.profit && neutral.profit > negative.profit);
  assert.ok(negative.profit < 0);
  assert.equal(investmentScenario(initial, monthly, 0, months, "negative").stocks, 0);
  assert.equal(investmentScenario(initial, monthly, 100, months, "negative").bonds, 0);
  assert.equal(investmentScenario(initial, monthly, 110, months, "negative"), null);
});

test("a savings goal computes weekly and end-of-month installments in minor units", () => {
  assert.deepEqual(savingsPlan(120_000, "2026-01-31", "2026-02-28"), {
    days: 28, weeks: 4, months: 1, perWeek: 30_000, perMonth: 120_000,
  });
  assert.equal(savingsPlan(100_001, "2026-01-31", "2026-03-30").perMonth, 50_001);
  assert.equal(savingsPlan(500, "2026-01-31", "2026-01-31").perWeek, 500);
  assert.equal(savingsPlan(500, "2026-02-01", "2026-01-31"), null);
});
