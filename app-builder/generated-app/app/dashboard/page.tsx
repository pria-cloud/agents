import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import createServerClient from '@/lib/supabase/server';
import { UserRole } from '@/types/supabase';

export default async function DashboardPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    // If profile is missing after login, something is wrong, redirect to login
    redirect('/login');
  }

  const userRole = profile.role as UserRole;

  switch (userRole) {
    case 'employee':
      redirect('/dashboard/employee');
      break;
    case 'manager':
      redirect('/dashboard/manager');
      break;
    case 'finance':
      redirect('/dashboard/finance');
      break;
    default:
      redirect('/login'); 
  }
}
