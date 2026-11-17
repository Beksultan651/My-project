import type { Account, Category, FinanceData, SavingsGoal, Transaction } from "../types/finance";

export type FinanceIssue = "recordChanged" | "accountInUse" | "categoryInUse" |
  "accountLimit" | "categoryLimit" | "txLimit" | "goalLimit" |
  "accountRequired" | "categoryRequired" | "formInvalid";

type Change<T> =
  | { next: T; previous?: T }
  | { next: null; previous: T };

export type FinanceAction =
  | ({ collection: "accounts" } & Change<Account>)
  | ({ collection: "categories" } & Change<Category>)
  | ({ collection: "transactions" } & Change<Transaction>)
  | ({ collection: "goals" } & Change<SavingsGoal>);

type ActionResult = { data: FinanceData } | { error: FinanceIssue };

function edit<T extends { id: string }>(
  records: T[], { next, previous }: Change<T>, limit: number, limitError: FinanceIssue,
): { records: T[] } | { error: FinanceIssue } {
  const id = previous?.id ?? next?.id;
  const current = records.find((item) => item.id === id);
  if (previous) {
    if (!current || JSON.stringify(current) !== JSON.stringify(previous)) return { error: "recordChanged" };
    return { records: next ? records.map((item) => item.id === id ? next : item) : records.filter((item) => item.id !== id) };
  }
  if (!next || current) return { error: "recordChanged" };
  if (records.length >= limit) return { error: limitError };
  return { records: [next, ...records] };
}

export function applyFinanceAction(data: FinanceData, action: FinanceAction): ActionResult {
  switch (action.collection) {
    case "accounts": {
      const { previous, next } = action;
      if (previous && next?.currency !== previous.currency &&
          data.transactions.some((entry) => entry.accountId === previous.id)) return { error: "accountInUse" };
      const result = edit<Account>(data.accounts, action, 100, "accountLimit");
      return "error" in result ? result : { data: { ...data, accounts: result.records } };
    }
    case "categories": {
      const { previous, next } = action;
      if (previous && next?.type !== previous.type &&
          data.transactions.some((entry) => entry.categoryId === previous.id)) return { error: "categoryInUse" };
      const result = edit<Category>(data.categories, action, 200, "categoryLimit");
      return "error" in result ? result : { data: { ...data, categories: result.records } };
    }
    case "transactions": {
      if (action.next) {
        const { accountId, categoryId, type } = action.next;
        if (!data.accounts.some((entry) => entry.id === accountId)) return { error: "accountRequired" };
        if (!data.categories.some((entry) => entry.id === categoryId && entry.type === type)) return { error: "categoryRequired" };
      }
      const result = edit<Transaction>(data.transactions, action, 10_000, "txLimit");
      return "error" in result ? result : { data: { ...data, transactions: result.records } };
    }
    case "goals": {
      const result = edit<SavingsGoal>(data.goals, action, 100, "goalLimit");
      return "error" in result ? result : { data: { ...data, goals: result.records } };
    }
  }
}

export function currencyLedger(data: FinanceData, currency: Account["currency"]) {
  const accounts = data.accounts.filter((account) => account.currency === currency);
  const ids = new Set(accounts.map((account) => account.id));
  return {
    initialBalance: accounts.reduce((sum, account) => sum + account.initialBalance, 0),
    transactions: data.transactions.filter((transaction) => ids.has(transaction.accountId)),
  };
}

export function referenceCounts<T>(
  values: readonly T[], keyOf: (value: T) => string,
) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = keyOf(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
