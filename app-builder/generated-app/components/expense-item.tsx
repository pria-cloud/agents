'use client';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Expense } from '@/types/supabase';
import { format } from 'date-fns';
import { updateExpenseStatus } from '@/actions/expenses';
import { useState } from 'react';

interface ExpenseItemProps {
  expense: Expense;
  isManager?: boolean;
  isFinance?: boolean;
}

export function ExpenseItem({ expense, isManager = false, isFinance = false }: ExpenseItemProps) {
  const [loading, setLoading] = useState(false);

  const handleStatusUpdate = async (newStatus: 'approved' | 'rejected') => {
    setLoading(true);
    const result = await updateExpenseStatus(expense.id, newStatus);
    if (result.success) {
      // Revalidation handled by server action, but can give local feedback
    } else {
      // Handle error message
    }
    setLoading(false);
  };

  const getStatusVariant = (status: Expense['status']) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'pending':
      default:
        return 'secondary';
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">{expense.category}</CardTitle>
        <Badge variant={getStatusVariant(expense.status)}>{expense.status}</Badge>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="text-2xl font-bold">{expense.amount.toFixed(2)} {expense.currency}</div>
        <CardDescription className="text-muted-foreground mt-1">
          Submitted: {format(new Date(expense.submitted_at), 'MMM dd, yyyy')}
          {expense.description && <p>{expense.description}</p>}
        </CardDescription>
        {expense.receipt_url && (
          <p className="mt-2 text-sm">
            <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              View Receipt
            </a>
          </p>
        )}
        {(expense.status === 'approved' || expense.status === 'rejected') && (expense.approved_by && expense.approved_at) && (
          <CardDescription className="text-muted-foreground mt-2">
            {expense.status === 'approved' ? 'Approved' : 'Rejected'} by: {expense.approved_by} on {format(new Date(expense.approved_at), 'MMM dd, yyyy')}
          </CardDescription>
        )}
      </CardContent>
      {isManager && expense.status === 'pending' && (
        <div className="p-4 border-t flex justify-end gap-2">
          <Button
            variant="default"
            onClick={() => handleStatusUpdate('approved')}
            disabled={loading}
          >
            {loading ? 'Approving...' : 'Approve'}
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleStatusUpdate('rejected')}
            disabled={loading}
          >
            {loading ? 'Rejecting...' : 'Reject'}
          </Button>
        </div>
      )}
    </Card>
  );
}
