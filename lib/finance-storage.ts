import { categories as legacyCategories, emptyData, MAX_MONEY, parseMoney, readData, STORAGE_KEY, validDate } from "./finance.ts";
import type { FinanceIssue } from "./finance-records";
import type { Account, AccountType, Category, Currency, FinanceData, SavingsGoal, Transaction, TransactionType } from "../types/finance";

export const currencies = ["KZT", "USD", "EUR"] as const satisfies readonly Currency[];
export const accountTypes = ["cash", "bank", "card", "savings"] as const satisfies readonly AccountType[];
export const accountLimit = 100;
export const categoryLimit = 200;
export const defaultAccountId = "default-kzt";
export const defaultAccountName = "Негізгі шот";
export const defaultCategories: Category[] = [
  ...["salary", "side-income", "gift", "other-income"].map((id, index) => ({
    id, name: legacyCategories.income[index], type: "income" as const,
  })),
  ...["food", "housing", "transport", "health", "education", "leisure", "other-expense"].map((id, index) => ({
    id, name: legacyCategories.expense[index], type: "expense" as const,
  })),
];

const initialData: FinanceData = {
  version: 2,
  accounts: [],
  categories: defaultCategories,
  transactions: [],
  goals: [],
  completedLessons: [],
  theme: "light",
  budget: emptyData.budget,
};

export function blankFinance(): FinanceData {
  return initialData;
}

export function newFinance(now: string, theme: FinanceData["theme"] = "light"): FinanceData {
  return {
    ...initialData,
    theme,
    accounts: [{ id: defaultAccountId, name: defaultAccountName, type: "cash", currency: "KZT", initialBalance: 0, createdAt: now }],
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isName = (value: unknown, max = 80): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const isId = (value: unknown): value is string => isName(value, 100);
const isMoney = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_MONEY;
const isKind = (value: unknown): value is TransactionType => value === "income" || value === "expense";
const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

function validAccount(value: unknown): value is Account {
  return isRecord(value) && isId(value.id) && isName(value.name) &&
    accountTypes.some((item) => item === value.type) && currencies.some((item) => item === value.currency) &&
    isMoney(value.initialBalance) && isTimestamp(value.createdAt);
}

function validCategory(value: unknown): value is Category {
  return isRecord(value) && isId(value.id) && isName(value.name) && isKind(value.type);
}

function validTransaction(value: unknown): value is Transaction {
  return isRecord(value) && isId(value.id) && isId(value.accountId) && isId(value.categoryId) &&
    isKind(value.type) && isMoney(value.amount) && value.amount > 0 && isName(value.description) &&
    validDate(value.date) && isTimestamp(value.createdAt) && isTimestamp(value.updatedAt) &&
    value.updatedAt >= value.createdAt;
}

function validGoal(value: unknown): value is SavingsGoal {
  return isRecord(value) && isId(value.id) && isName(value.name) &&
    isMoney(value.targetAmount) && value.targetAmount > 0 && isMoney(value.savedAmount) &&
    value.savedAmount <= value.targetAmount && (value.deadline === "" || validDate(value.deadline)) &&
    isTimestamp(value.createdAt) && isTimestamp(value.updatedAt) && value.updatedAt >= value.createdAt;
}

function validRecords<T extends { id: string }>(
  value: unknown, limit: number, validate: (entry: unknown) => entry is T,
): value is T[] {
  return Array.isArray(value) && value.length <= limit && value.every(validate) &&
    new Set(value.map((entry) => entry.id)).size === value.length;
}

export function isFinanceData(value: unknown): value is FinanceData {
  if (!isRecord(value) || value.version !== 2 || (value.theme !== "light" && value.theme !== "dark")) return false;
  if (!validRecords(value.accounts, accountLimit, validAccount) ||
      !validRecords(value.categories, categoryLimit, validCategory) ||
      !validRecords(value.transactions, 10_000, validTransaction) ||
      !validRecords(value.goals, 100, validGoal)) return false;

  const accountIds = new Set(value.accounts.map((entry) => entry.id));
  const categoryTypes = new Map(value.categories.map((entry) => [entry.id, entry.type]));
  if (!value.transactions.every((entry) => accountIds.has(entry.accountId) && categoryTypes.get(entry.categoryId) === entry.type)) return false;

  const lessons = value.completedLessons;
  if (!Array.isArray(lessons) || lessons.length > 6 || new Set(lessons).size !== lessons.length ||
      !lessons.every((entry) => typeof entry === "string" && /^lesson-[1-6]$/.test(entry))) return false;

  const budget = value.budget;
  return isRecord(budget) && Object.keys(emptyData.budget).every((key) => {
    const field = budget[key];
    return typeof field === "string" && (field === "" || parseMoney(field) !== null);
  });
}

export function decodeFinance(raw: string, now: string): FinanceData | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (isFinanceData(value)) return value;
  if (!isRecord(value) || value.version !== 1) return null;
  const legacy = readData(raw);
  if (!legacy) return null;

  const migrated: FinanceData = {
    ...newFinance(now, legacy.theme),
    budget: legacy.budget,
    completedLessons: legacy.completedLessons,
    transactions: legacy.transactions.map((entry) => {
      const category = defaultCategories.find((item) => item.name === entry.category && item.type === entry.type)!;
      const timestamp = `${entry.date}T00:00:00.000Z`;
      return {
        id: entry.id, description: entry.title, type: entry.type, amount: entry.amount,
        accountId: defaultAccountId, categoryId: category.id, date: entry.date,
        createdAt: timestamp, updatedAt: timestamp,
      };
    }),
    goals: legacy.goals.map((entry) => ({
      id: entry.id, name: entry.title, targetAmount: entry.target, savedAmount: entry.saved,
      deadline: entry.deadline, createdAt: now, updatedAt: now,
    })),
  };
  return isFinanceData(migrated) ? migrated : null;
}

export type StorageIssue = "storageInvalid" | "storageBlocked" | "storageSave";
export type FinanceChange = { data: FinanceData } | { error: FinanceIssue };
type StoragePort = Pick<Storage, "getItem" | "setItem">;

export function loadFinance(storage: StoragePort, fallback: FinanceData, migrationTime: string) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const data = raw === null ? fallback : decodeFinance(raw, migrationTime);
    return data ? { data } as const : { error: "storageInvalid" } as const;
  } catch {
    return { error: "storageBlocked" } as const;
  }
}

export function commitFinance(
  storage: StoragePort, fallback: FinanceData, migrationTime: string,
  change: (current: FinanceData) => FinanceChange,
): { data: FinanceData } | { error: FinanceIssue | StorageIssue; current?: FinanceData } {
  const latest = loadFinance(storage, fallback, migrationTime);
  if ("error" in latest) return latest;

  const result = change(latest.data);
  if ("error" in result) return { error: result.error, current: latest.data };
  if (!isFinanceData(result.data)) return { error: "formInvalid", current: latest.data };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(result.data));
    return result;
  } catch {
    return { error: "storageSave", current: latest.data };
  }
}
