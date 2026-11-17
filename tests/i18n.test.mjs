import test from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatMoney, isLocale, locales, messages, resolveLocale, shortMonths, translate, translatedCategory } from "../lib/i18n.ts";
import { localizeLessons } from "../lib/lesson-translations.ts";
import { lessons } from "../lib/finance.ts";
import { filterTransactions } from "../lib/transactions.ts";

test("барлық интерфейс мәтінінің үш аудармасы және бірдей параметрлері бар", () => {
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [key, values] of Object.entries(messages)) {
    assert.equal(values.length, 3, key);
    for (const text of values) {
      assert.ok(text.trim().length > 0, key);
      assert.deepEqual(placeholders(text), placeholders(values[0]), key);
    }
  }
  for (const locale of locales) assert.ok(!translate(locale, "lessonNumber", { number: 3 }).includes("{number}"));
});

test("тілді оқу жарамсыз сақталған мәндерге төзімді", () => {
  for (const locale of locales) { assert.equal(resolveLocale(locale), locale); assert.equal(isLocale(locale), true); }
  for (const invalid of [null, undefined, "de", "KK", {}, 1]) { assert.equal(resolveLocale(invalid), "kk"); assert.equal(isLocale(invalid), false); }
});

test("ақша мен күндер таңдалған тілде көрсетіледі", () => {
  assert.equal(formatMoney(123456789, "kk"), "1\u00a0234\u00a0567,89 ₸");
  assert.equal(formatMoney(-123456789, "ru"), "−1\u00a0234\u00a0567,89 ₸");
  assert.equal(formatMoney(123456789, "en"), "1,234,567.89 ₸");
  assert.equal(formatMoney(0, "en"), "0 ₸");
  assert.equal(formatDate("2026-11-03", "kk", true), "3 қараша 2026");
  assert.equal(formatDate("2026-11-03", "ru", true), "3 ноября 2026");
  assert.equal(formatDate("2026-11-03", "en", true), "November 3, 2026");
  assert.equal(formatDate("2026-11-03", "en"), "Nov 3");
  for (const locale of locales) {
    assert.equal(shortMonths[locale].length, 12);
    for (const invalid of ["invalid", "2026-02-30", "2026-13-01"]) assert.equal(formatDate(invalid, locale), "—");
  }
});

test("аударылған санатпен іздеу жазбадағы бастапқы деректі өзгертпейді", () => {
  const transactions = [{ id: "i18n-test", type: "expense", amount: 12345, description: "Менің сатып алуым", categoryId: "Азық-түлік", date: "2026-11-03" }];
  const original = structuredClone(transactions);
  for (const [locale, query] of [["ru", "продукты"], ["en", "groceries"], ["kk", "азық"]]) {
    const result = filterTransactions(transactions, { query, type: "all", month: "", category: "", sort: "newest", categoryLabel: (category) => translatedCategory(category, locale) });
    assert.equal(result.length, 1, locale);
    assert.equal(result[0].description, "Менің сатып алуым");
  }
  assert.deepEqual(transactions, original);
  assert.equal(translatedCategory("Арнайы санат", "en"), "Арнайы санат");
});

test("алты сабақтың мазмұны мен тесті аударылады, жауап индекстері сақталады", () => {
  const original = structuredClone(lessons);
  for (const locale of locales) {
    const translated = localizeLessons(lessons, locale);
    assert.equal(translated.length, 6);
    for (let index = 0; index < translated.length; index += 1) {
      const lesson = translated[index];
      assert.equal(lesson.id, lessons[index].id);
      assert.equal(lesson.correct, lessons[index].correct);
      assert.equal(lesson.answers.length, 3);
      assert.equal(lesson.paragraphs.length, 3);
      for (const text of [lesson.title, lesson.description, lesson.question, ...lesson.answers, ...lesson.paragraphs]) assert.ok(text.trim());
      if (locale !== "kk") assert.notEqual(lesson.title, lessons[index].title);
    }
  }
  assert.deepEqual(lessons, original);
});
