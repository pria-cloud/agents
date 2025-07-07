```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import { ReceiptUpload } from './receipt-upload';

// Mock the '@/actions/expenses' module to prevent actual network calls
vi.mock('@/actions/expenses', () => ({
  uploadReceipt: vi.fn(() => Promise.resolve({ success: true, url: 'mock-receipt-url.jpg' })),
}));

describe('ReceiptUpload', () => {
  it('renders without crashing', () => {
    // Mock the callback functions required by the component props
    const onUploadSuccessMock = vi.fn();
    const onUploadErrorMock = vi.fn();

    render(
      <ReceiptUpload
        onUploadSuccess={onUploadSuccessMock}
        onUploadError={onUploadErrorMock}
      />
    );

    // Assert that a key element of the component is present in the document,
    // indicating it rendered successfully.
    expect(screen.getByLabelText(/receipt/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload receipt/i })).toBeInTheDocument();
  });
});
```