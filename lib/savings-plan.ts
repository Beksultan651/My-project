import { validDate } from "./finance.ts";

const DAY_MS = 86_400_000;

/** Remaining installments, starting one interval from today and counting a short final interval. */
export function savingsPlan(remaining: number, today: string, deadline: string) {
  if (!Number.isSafeInteger(remaining) || remaining <= 0 || !validDate(today) ||
      !validDate(deadline) || deadline < today) return null;

  const start = new Date(today + "T00:00:00Z");
  const end = new Date(deadline + "T00:00:00Z");
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const weeks = Math.max(1, Math.ceil(days / 7));
  const fullMonths = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() - start.getUTCMonth();
  const lastOfMonth = new Date(end);
  lastOfMonth.setUTCMonth(end.getUTCMonth() + 1, 0);
  const monthlyAnchor = Math.min(start.getUTCDate(), lastOfMonth.getUTCDate());
  const months = Math.max(1, fullMonths + (end.getUTCDate() > monthlyAnchor ? 1 : 0));

  return { days, weeks, months, perWeek: Math.ceil(remaining / weeks), perMonth: Math.ceil(remaining / months) };
}
