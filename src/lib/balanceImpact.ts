export type ImpactInput = {
  type: 'income' | 'expense' | 'investment';
  amount: number;
  investment_operation?: 'deposit' | 'withdraw' | 'yield' | 'loss';
};

export interface BalanceImpact {
  label: 'Saldo disponível' | 'Saldo investido';
  before: number;
  after: number;
}

/** Projects how a pending transaction changes the user's balance before confirming. */
export function computeBalanceImpact(
  tx: ImpactInput,
  availableBalance: number,
  investedBalance: number,
): BalanceImpact | null {
  const amt = Math.abs(Number(tx.amount) || 0);
  if (amt === 0) return null;
  if (tx.type === 'income') return { label: 'Saldo disponível', before: availableBalance, after: availableBalance + amt };
  if (tx.type === 'expense') return { label: 'Saldo disponível', before: availableBalance, after: availableBalance - amt };
  const op = tx.investment_operation ?? 'deposit';
  if (op === 'deposit') return { label: 'Saldo disponível', before: availableBalance, after: availableBalance - amt };
  if (op === 'withdraw') return { label: 'Saldo disponível', before: availableBalance, after: availableBalance + amt };
  const sign = op === 'yield' ? 1 : -1;
  return { label: 'Saldo investido', before: investedBalance, after: investedBalance + sign * amt };
}
