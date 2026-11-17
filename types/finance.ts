export type TransactionType = "income" | "expense";
export type AccountType = "cash" | "bank" | "card" | "savings";
export type Currency = "KZT" | "USD" | "EUR";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  currency: Currency;
  createdAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
}

export type Budget = Record<"income" | "housing" | "food" | "transport" | "other", string>;

export interface FinanceData {
  version: 2;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  goals: SavingsGoal[];
  completedLessons: string[];
  theme: "light" | "dark";
  budget: Budget;
}
