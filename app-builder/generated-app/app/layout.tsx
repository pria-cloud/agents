import './globals.css';
import { Inter } from 'next/font/google';
import createServerClient from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { MainNav } from '@/components/main-nav';
import type { User } from '@supabase/supabase-js';
import { UserRole } from '@/types/supabase';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'PRIA Expense Management',
  description: 'Expense management application for employees, managers, and finance teams.'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  let userRole: UserRole | null = null;

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile && !profileError) {
      userRole = profile.role as UserRole;
    }
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <MainNav user={user} role={userRole} />
        <main className="container mx-auto py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
