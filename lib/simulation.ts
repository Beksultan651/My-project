/** Monthly compounding, with contributions at the end of each month. Amounts are in тиын. */
export function deposit(initial: number, contribution: number, apr: number, inflation: number, months: number) {
  if (![initial, contribution].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 100_000_000_000)
    || ![apr, inflation].every(n => Number.isFinite(n) && n >= 0 && n <= 50)
    || !Number.isInteger(months) || months < 1 || months > 120) return null;
  let balance = initial;
  const history = [initial];
  for (let i = 0; i < months; i++) {
    balance = Math.round(balance * (1 + apr / 1200)) + contribution;
    history.push(balance);
  }
  return { balance, history, interest: balance - initial - contribution * months,
    purchasingPower: Math.round(balance / (1 + inflation / 100) ** (months / 12)) };
}

export const scenarios = ["positive", "neutral", "negative"] as const;
export type Scenario = typeof scenarios[number];

// Fictional monthly changes in basis points, repeated for longer exercises.
const changes = {
  positive: { stock: [180, -90, 220, 80, 140, -35], bond: [40, 25, -15, 35, 45, 30] },
  neutral: { stock: [-140, 135, 90, -85, 110, -105], bond: [15, 5, -20, 10, 15, 0] },
  negative: { stock: [-300, 120, -235, 75, -185, -50], bond: [-40, 15, -60, 25, -20, 10] },
};

export function investmentScenario(initial: number, contribution: number, stocksPercent: number, months: number, scenario: Scenario) {
  if (![initial, contribution].every((n) => Number.isSafeInteger(n) && n >= 0 && n <= 100_000_000_000) ||
      !Number.isInteger(stocksPercent) || stocksPercent < 0 || stocksPercent > 100 ||
      !Number.isInteger(months) || months < 1 || months > 120 || !scenarios.includes(scenario)) return null;

  const rates = changes[scenario];
  let stocks = Math.round(initial * stocksPercent / 100);
  let bonds = initial - stocks;
  const stocksContribution = Math.round(contribution * stocksPercent / 100);
  const history = [initial];
  for (let i = 0; i < months; i++) {
    const index = i % rates.stock.length;
    stocks = Math.round(stocks * (1 + rates.stock[index] / 10_000)) + stocksContribution;
    bonds = Math.round(bonds * (1 + rates.bond[index] / 10_000)) + (contribution - stocksContribution);
    history.push(stocks + bonds);
  }
  const balance = stocks + bonds;
  const paid = initial + contribution * months;
  return { balance, paid, profit: balance - paid, stocks, bonds, history };
}
