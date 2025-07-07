```typescript
// components/main-nav.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, vi } from 'vitest';
import { MainNav } from './main-nav';

// Mock Next.js Link component to prevent actual navigation logic or warnings
// in a non-Next.js test environment. It renders as a simple anchor tag.
vi.mock('next/link', () => ({
  default: vi.fn(({ children, href }) => <a href={href}>{children}</a>),
}));

// Mock the signOut action to prevent actual server calls or errors during tests.
// This is crucial for components interacting with backend actions.
vi.mock('@/actions/auth', () => ({
  signOut: vi.fn(), // A simple mock function that does nothing
}));

describe('MainNav', () => {
  /**
   * Smoke test to verify the component renders without crashing when
   * a user is not authenticated.
   */
  it('renders without crashing for unauthenticated state', () => {
    // Render the component with null user and role, simulating an unauthenticated state.
    render(<MainNav user={null} role={null} />);

    // Assert that the main application title is present.
    expect(screen.getByText('PRIA Expenses')).toBeInTheDocument();
    // Assert that the "Sign In" button is visible for unauthenticated users.
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  /**
   * Smoke test to verify the component renders without crashing when
   * a user is authenticated, specifically as an 'employee'.
   * This covers the authenticated user branch of the component's logic.
   */
  it('renders without crashing for authenticated employee state', () => {
    // Define a mock user object. Only properties accessed by the component (like 'email')
    // and those structurally required by the User type are strictly necessary for a smoke test.
    const mockUser = {
      id: 'user-123',
      email: 'test.employee@example.com',
      // Include other minimal properties required by Supabase User type
      aud: 'authenticated',
      role: 'authenticated',
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
      phone: null,
      factor_id: null,
      confirmed_at: new Date().toISOString(),
    };

    // Render the component with the mock authenticated user and 'employee' role.
    render(<MainNav user={mockUser} role="employee" />);

    // Assert that the welcome message displaying the user's email is present.
    expect(screen.getByText(`Welcome, ${mockUser.email}`)).toBeInTheDocument();
    // Assert that the "Sign Out" button is visible for authenticated users.
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
    // Assert that the "My Expenses" link is visible for employees.
    expect(screen.getByRole('link', { name: 'My Expenses' })).toBeInTheDocument();
  });
});
```