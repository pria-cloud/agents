'use server';

import { cookies } from 'next/headers';
import createServerClient from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { Expense, ExpenseStatus, UserRole } from '@/types/supabase';

async function getWorkspaceId(supabase: ReturnType<typeof createServerClient>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return user.app_metadata?.workspace_id as string | null;
}

export async function createExpense(formData: FormData) {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);
  const workspaceId = await getWorkspaceId(supabase);

  if (!workspaceId) {
    return { success: false, message: 'User not authenticated or workspace ID not found.' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  const amount = parseFloat(formData.get('amount') as string);
  const currency = formData.get('currency') as Expense['currency'];
  const category = formData.get('category') as Expense['category'];
  const description = formData.get('description') as string | null;
  const receiptUrl = formData.get('receiptUrl') as string | null;

  if (isNaN(amount) || amount <= 0) {
    return { success: false, message: 'Invalid amount.' };
  }

  const newExpense: Omit<Expense, 'id' | 'submitted_at' | 'approved_by' | 'approved_at'> = {
    user_id: user.id,
    workspace_id: workspaceId,
    amount,
    currency,
    category,
    description,
    receipt_url: receiptUrl,
    status: 'pending'
  };

  const { error } = await supabase.from('expenses').insert(newExpense);

  if (error) {
    return { success: false, message: `Failed to create expense: ${error.message}` };
  }

  revalidatePath('/dashboard/employee');
  revalidatePath('/dashboard/manager');
  revalidatePath('/dashboard/finance');
  return { success: true, message: 'Expense submitted successfully!' };
}

export async function getExpensesByStatus(statuses: ExpenseStatus[]) {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);
  const workspaceId = await getWorkspaceId(supabase);

  if (!workspaceId) {
    return { data: [], error: 'Workspace ID not found for user.' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: [], error: 'Authentication required.' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { data: [], error: 'Profile not found.' };
  }

  let query = supabase.from('expenses').select('*').eq('workspace_id', workspaceId);

  if (statuses.length > 0) {
    query = query.in('status', statuses);
  }

  if (profile.role === 'employee') {
    query = query.eq('user_id', user.id);
  }

  const { data, error } = await query.order('submitted_at', { ascending: false });

  if (error) {
    return { data: [], error: `Failed to fetch expenses: ${error.message}` };
  }

  return { data: data as Expense[], error: null };
}

export async function updateExpenseStatus(expenseId: string, newStatus: ExpenseStatus) {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);
  const workspaceId = await getWorkspaceId(supabase);

  if (!workspaceId) {
    return { success: false, message: 'Workspace ID not found for user.' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  const { error } = await supabase
    .from('expenses')
    .update({
      status: newStatus,
      approved_by: user.id,
      approved_at: new Date().toISOString()
    })
    .eq('id', expenseId)
    .eq('workspace_id', workspaceId);

  if (error) {
    return { success: false, message: `Failed to update expense status: ${error.message}` };
  }

  revalidatePath('/dashboard/manager');
  revalidatePath('/dashboard/finance');
  revalidatePath('/dashboard/employee');
  return { success: true, message: 'Expense status updated successfully!' };
}

export async function uploadReceipt(formData: FormData) {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);
  const workspaceId = await getWorkspaceId(supabase);

  if (!workspaceId) {
    return { success: false, message: 'Workspace ID not found for user.' };
  }

  const file = formData.get('file') as File;

  if (!file) {
    return { success: false, message: 'No file provided.' };
  }

  const fileName = `${workspaceId}/${crypto.randomUUID()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from('receipts')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (error) {
    return { success: false, message: `Failed to upload receipt: ${error.message}` };
  }

  const { data: publicUrlData } = supabase.storage
    .from('receipts')
    .getPublicUrl(fileName);

  return { success: true, message: 'Receipt uploaded successfully!', url: publicUrlData.publicUrl };
}

export async function getAllExpenses() {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);
  const workspaceId = await getWorkspaceId(supabase);

  if (!workspaceId) {
    return { data: [], error: 'Workspace ID not found for user.' };
  }

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('submitted_at', { ascending: false });

  if (error) {
    return { data: [], error: `Failed to fetch all expenses: ${error.message}` };
  }

  return { data: data as Expense[], error: null };
}
