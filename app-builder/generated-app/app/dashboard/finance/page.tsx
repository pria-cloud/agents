import { ExpenseList } from '@/components/expense-list';
import { getAllExpenses } from '@/actions/expenses';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function FinanceDashboardPage() {
  const { data: expenses, error } = await getAllExpenses();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Finance Dashboard</h1>
      <div className="flex justify-end mb-4">
        <Button asChild>
          <Link href="/api/export">Export All Expenses (CSV)</Link>
        </Button>
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-4">All Expenses</h2>
        {error ? (
          <p className="text-red-500">Error loading expenses: {error}</p>
        ) : (
          <ExpenseList expenses={expenses} isFinance={true} />
        )}
      </div>
    </div>
  );
}
