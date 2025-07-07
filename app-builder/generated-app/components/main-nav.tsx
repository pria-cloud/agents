'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from '@/actions/auth';
import type { User } from '@supabase/supabase-js';
import { UserRole } from '@/types/supabase';

interface MainNavProps {
  user: User | null;
  role: UserRole | null;
}

export function MainNav({ user, role }: MainNavProps) {
  return (
    <nav className="flex items-center justify-between p-4 bg-primary text-primary-foreground shadow-md">
      <Link href="/dashboard" className="text-xl font-bold">
        PRIA Expenses
      </Link>
      <div className="flex items-center space-x-4">
        {user ? (
          <>
            <span className="text-sm font-medium">Welcome, {user.email}</span>
            {role === 'employee' && (
              <Link href="/dashboard/employee" className="hover:underline">
                My Expenses
              </Link>
            )}
            {role === 'manager' && (
              <Link href="/dashboard/manager" className="hover:underline">
                Pending Approvals
              </Link>
            )}
            {role === 'finance' && (
              <Link href="/dashboard/finance" className="hover:underline">
                All Expenses
              </Link>
            )}
            <form action={signOut}>
              <Button variant="secondary" size="sm">
                Sign Out
              </Button>
            </form>
          </>
        ) : (
          <Link href="/login">
            <Button variant="secondary" size="sm">
              Sign In
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
}
