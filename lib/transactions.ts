import type { Transaction } from "../types/finance";

export type TransactionSort = "newest" | "oldest" | "amount-desc" | "amount-asc";
export type TransactionFilters = {
  query?: string;
  type?: "all" | Transaction["type"];
  month?: string;
  category?: string;
  account?: string;
  sort?: TransactionSort;
  categoryLabel?: (category: string) => string;
  accountLabel?: (account: string) => string;
  accountCurrency?: (account: string) => string;
};

/** Іздеу, сүзу және сұрыптау бастапқы массивті өзгертпейді. */
export function filterTransactions(transactions: Transaction[], filters: TransactionFilters = {}) {
  const query = (filters.query ?? "").trim().toLocaleLowerCase("kk");
  return transactions.filter((transaction) =>
    (!filters.type || filters.type === "all" || transaction.type === filters.type) &&
    (!filters.month || transaction.date.startsWith(filters.month)) &&
    (!filters.category || transaction.categoryId === filters.category) &&
    (!filters.account || transaction.accountId === filters.account) &&
    (!query || `${transaction.description} ${filters.categoryLabel?.(transaction.categoryId) ?? ""} ${filters.accountLabel?.(transaction.accountId) ?? ""}`.toLocaleLowerCase("kk").includes(query)),
  ).sort((a, b) => {
    if (filters.accountCurrency && (filters.sort === "amount-desc" || filters.sort === "amount-asc")) {
      const byCurrency = filters.accountCurrency(a.accountId).localeCompare(filters.accountCurrency(b.accountId));
      if (byCurrency) return byCurrency;
    }
    if (filters.sort === "amount-desc") return b.amount - a.amount || b.date.localeCompare(a.date);
    if (filters.sort === "amount-asc") return a.amount - b.amount || b.date.localeCompare(a.date);
    if (filters.sort === "oldest") return a.date.localeCompare(b.date);
    return b.date.localeCompare(a.date);
  });
}
