'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { createExpense } from '@/actions/expenses';
import { ExpenseCurrency, ExpenseCategory } from '@/types/supabase';
import { ReceiptUpload } from './receipt-upload';

export function ExpenseForm() {
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<ExpenseCurrency>('USD');
  const [category, setCategory] = useState<ExpenseCategory>('Travel');
  const [description, setDescription] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

  const handleReceiptUploadSuccess = (url: string) => {
    setReceiptUrl(url);
    setMessage('Receipt uploaded successfully!');
    setIsSuccess(true);
  };

  const handleReceiptUploadError = (msg: string) => {
    setReceiptUrl(null);
    setMessage(msg);
    setIsSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsSuccess(null);
    setLoading(true);

    if (!amount || parseFloat(amount) <= 0) {
      setMessage('Please enter a valid amount.');
      setIsSuccess(false);
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('amount', amount);
    formData.append('currency', currency);
    formData.append('category', category);
    formData.append('description', description);
    if (receiptUrl) {
      formData.append('receiptUrl', receiptUrl);
    }

    const result = await createExpense(formData);

    if (result.success) {
      setMessage(result.message);
      setIsSuccess(true);
      setAmount('');
      setDescription('');
      setReceiptUrl(null);
    } else {
      setMessage(result.message || 'Failed to submit expense.');
      setIsSuccess(false);
    }
    setLoading(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Submit New Expense</CardTitle>
        <CardDescription>Fill out the details for your expense report.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="amount">Amount</Label>
            <Input
              type="number"
              id="amount"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              required
            />
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={(value: ExpenseCurrency) => setCurrency(value)}>
              <SelectTrigger id="currency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(value: ExpenseCategory) => setCategory(value)}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Travel">Travel</SelectItem>
                <SelectItem value="Meals">Meals</SelectItem>
                <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                <SelectItem value="Software">Software</SelectItem>
                <SelectItem value="Utilities">Utilities</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the expense"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <ReceiptUpload
            onUploadSuccess={handleReceiptUploadSuccess}
            onUploadError={handleReceiptUploadError}
          />
          {receiptUrl && (
            <p className="text-sm text-muted-foreground">Receipt attached: <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="underline">View</a></p>
          )}
          {message && (
            <p className={`text-sm ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>{message}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Expense'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
