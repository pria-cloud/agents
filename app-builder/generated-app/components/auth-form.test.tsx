```typescript
// components/auth-form.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthForm } from './auth-form';

// Mock useRouter from 'next/navigation'
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock server actions
vi.mock('@/actions/auth', () => ({
  signIn: vi.fn(() => Promise.resolve({ success: true })),
  signUp: vi.fn(() => Promise.resolve({ success: true })),
}));

describe('AuthForm', () => {
  it('renders the sign-in form without crashing', () => {
    render(<AuthForm isSignUp={false} />);
    expect(screen.getByText(/Sign in to your account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
  });

  it('renders the sign-up form without crashing', () => {
    render(<AuthForm isSignUp={true} />);
    expect(screen.getByText(/Create an account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign up/i })).toBeInTheDocument();
  });
});
```