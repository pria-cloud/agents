'use client';

import { Expense } from '@/types/supabase';
import { ExpenseItem } from './expense-item';

interface ExpenseListProps {
  expenses: Expense[];
  isManager?: boolean;
  isFinance?: boolean;
}

export function ExpenseList({ expenses, isManager = false, isFinance = false }: ExpenseListProps) {
  if (expenses.length === 0) {
    return <p className="text-center text-muted-foreground">No expenses to display.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {expenses.map((expense) => (
        <ExpenseItem
          key={expense.id}
          expense={expense}
          isManager={isManager}
          isFinance={isFinance}
        />
      ))}
    </div>
  );
}
