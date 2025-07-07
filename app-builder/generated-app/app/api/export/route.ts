import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import createServerClient from '@/lib/supabase/server';

export async function GET() {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Authentication required', { status: 401 });
  }

  const workspaceId = user.app_metadata?.workspace_id as string | undefined;
  if (!workspaceId) {
    return new NextResponse('Workspace ID not found for user', { status: 400 });
  }

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('submitted_at', { ascending: false });

  if (error) {
    return new NextResponse(`Failed to fetch expenses: ${error.message}`, { status: 500 });
  }

  if (!expenses || expenses.length === 0) {
    return new NextResponse('No expenses to export', { status: 204 });
  }

  // Convert data to CSV format
  const headers = Object.keys(expenses[0]).join(',');
  const csvRows = expenses.map(row =>
    Object.values(row)
      .map(value => {
        if (value === null || value === undefined) return '';
        // Escape double quotes by doubling them, then wrap in double quotes if it contains commas or newlines
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(',')
  );

  const csv = [headers, ...csvRows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="expenses.csv"'
    }
  });
}
