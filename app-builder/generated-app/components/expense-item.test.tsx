```typescript
// components/expense-item.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExpenseItem } from './expense-item';
import type { Expense } from '@/types/supabase'; // Assuming this path

// Mock the server action to prevent actual network calls
vi.mock('@/actions/expenses', () => ({
  updateExpenseStatus: vi.fn(() => ({ success: true })),
}));

describe('ExpenseItem', () => {
  const mockExpense: Expense = {
    id: 'exp_123',
    user_id: 'user_456',
    category: 'Office Supplies',
    amount: 123.45,
    currency: 'USD',
    status: 'pending',
    submitted_at: '2023-10-26T10:00:00Z',
    description: 'New printer ink cartridges',
    receipt_url: null,
    approved_by: null,
    approved_at: null,
  };

  it('renders without crashing', () => {
    render(<ExpenseItem expense={mockExpense} />);

    // Assert that a key piece of information from the component is present
    // This verifies that the component successfully rendered its content.
    expect(screen.getByText(mockExpense.category)).toBeInTheDocument();
    expect(screen.getByText(`${mockExpense.amount.toFixed(2)} ${mockExpense.currency}`)).toBeInTheDocument();
    expect(screen.getByText(mockExpense.status)).toBeInTheDocument();
  });
});
```