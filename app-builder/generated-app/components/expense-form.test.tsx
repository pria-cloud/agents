```typescript
// components/expense-form.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExpenseForm } from './expense-form';

// Mock the action that performs data fetching/mutation
vi.mock('@/actions/expenses', () => ({
  createExpense: vi.fn(() => ({ success: true, message: 'Mock expense created successfully' })),
}));

// Mock the ReceiptUpload component to prevent actual file input/upload logic
vi.mock('./receipt-upload', () => ({
  ReceiptUpload: vi.fn(() => <div data-testid="mock-receipt-upload" />),
}));

describe('ExpenseForm', () => {
  it('renders without crashing', () => {
    render(<ExpenseForm />);

    // Verify key elements are present to confirm successful rendering
    expect(screen.getByRole('heading', { name: /Submit New Expense/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Currency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Expense/i })).toBeInTheDocument();

    // Verify that the mocked ReceiptUpload component is rendered
    expect(screen.getByTestId('mock-receipt-upload')).toBeInTheDocument();
  });
});
```