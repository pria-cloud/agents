import { ExpenseForm } from '@/components/expense-form';
import { ExpenseList } from '@/components/expense-list';
import { getExpensesByStatus } from '@/actions/expenses';

export default async function EmployeeDashboardPage() {
  const { data: expenses, error } = await getExpensesByStatus([]); // Fetch all expenses for employee

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Employee Dashboard</h1>
      <ExpenseForm />
      <div>
        <h2 className="text-2xl font-bold mb-4">My Submitted Expenses</h2>
        {error ? (
          <p className="text-red-500">Error loading expenses: {error}</p>
        ) : (
          <ExpenseList expenses={expenses} />
        )}
      </div>
    </div>
  );
}
