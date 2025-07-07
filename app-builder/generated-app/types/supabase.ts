export type ExpenseStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'employee' | 'manager' | 'finance';
export type ExpenseCurrency = 'USD' | 'EUR' | 'GBP';
export type ExpenseCategory = 'Travel' | 'Meals' | 'Office Supplies' | 'Software' | 'Utilities' | 'Other';

export interface Expense {
  id: string;
  user_id: string;
  workspace_id: string;
  amount: number;
  currency: ExpenseCurrency;
  category: ExpenseCategory;
  description: string | null;
  receipt_url: string | null;
  status: ExpenseStatus;
  submitted_at: string;
  approved_by: string | null;
  approved_at: string | null;
}

export interface Profile {
  id: string;
  workspace_id: string;
  role: UserRole;
  full_name: string | null;
  email: string;
}
