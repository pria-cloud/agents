import { ExpenseList } from '@/components/expense-list';
import { getExpensesByStatus } from '@/actions/expenses';

export default async function ManagerDashboardPage() {
  const { data: expenses, error } = await getExpensesByStatus(['pending']);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Manager Dashboard</h1>
      <div>
        <h2 className="text-2xl font-bold mb-4">Pending Expenses for Approval</h2>
        {error ? (
          <p className="text-red-500">Error loading expenses: {error}</p>
        ) : (
          <ExpenseList expenses={expenses} isManager={true} />
        )}
      </div>
    </div>
  );
}
