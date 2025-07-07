```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExpenseList } from './expense-list';
import { Expense } from '@/types/supabase'; // Assume this path and type exist

// Mock data for Expense[] to simulate valid expenses
const mockExpenses: Expense[] = [
  {
    id: 'exp-1',
    amount: 100.50,
    currency: 'USD',
    date: '2023-01-15T10:00:00Z',
    description: 'Team Lunch',
    status: 'pending',
    category: 'Food',
    requester_id: 'user-abc',
    approver_id: null,
    created_at: '2023-01-14T09:00:00Z',
    updated_at: '2023-01-14T09:00:00Z',
    receipt_url: null,
    manager_notes: null,
    finance_notes: null,
    project_id: null,
  },
  {
    id: 'exp-2',
    amount: 75.00,
    currency: 'GBP',
    date: '2023-01-10T14:30:00Z',
    description: 'Office Supplies',
    status: 'approved',
    category: 'Supplies',
    requester_id: 'user-xyz',
    approver_id: 'user-manager',
    created_at: '2023-01-09T13:00:00Z',
    updated_at: '2023-01-09T15:00:00Z',
    receipt_url: 'https://example.com/receipt2.jpg',
    manager_notes: 'Approved for Q1 budget',
    finance_notes: null,
    project_id: 'proj-123',
  },
];

// For a basic smoke test, we want to ensure the component renders without throwing errors
// in its different states (empty and non-empty list).

describe('ExpenseList', () => {
  it('renders without crashing when expenses are provided', () => {
    // Render the component with mock expenses
    render(<ExpenseList expenses={mockExpenses} />);

    // Assert that key elements from the mock data are present, indicating successful render
    expect(screen.getByText('Team Lunch')).toBeInTheDocument();
    expect(screen.getByText('Office Supplies')).toBeInTheDocument();
  });

  it('renders "No expenses to display." when the expenses array is empty', () => {
    // Render the component with an empty expenses array
    render(<ExpenseList expenses={[]} />);

    // Assert that the empty state message is displayed
    expect(screen.getByText('No expenses to display.')).toBeInTheDocument();
  });
});
```