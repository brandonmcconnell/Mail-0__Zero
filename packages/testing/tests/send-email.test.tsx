import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, createTestCaller, mockEmailData, mockConnection, mockSettings } from '../utils/test-utils';
import { mockAgent } from '../setup';
import { CreateEmail } from '@zero/mail/components/create/create-email';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@zero/mail/hooks/use-settings', () => ({
  useSettings: () => ({
    data: mockSettings,
    isLoading: false,
  }),
}));

vi.mock('@zero/mail/hooks/use-active-connection', () => ({
  useActiveConnection: () => ({
    data: mockConnection,
  }),
}));

vi.mock('@zero/mail/hooks/use-email-aliases', () => ({
  useEmailAliases: () => ({
    data: [{ email: 'test@example.com', primary: true }],
  }),
}));

vi.mock('@zero/mail/hooks/use-draft', () => ({
  useDraft: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock('nuqs', () => ({
  useQueryState: vi.fn((key: string) => {
    if (key === 'isComposeOpen') return ['true', vi.fn()];
    return [null, vi.fn()];
  }),
}));

describe('Real <CreateEmail /> Integration Test', () => {
  const user = userEvent.setup();
  const queryClient = new QueryClient();

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <CreateEmail />
      </QueryClientProvider>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('should render the component and send an email successfully', async () => {
    renderComponent();

    await user.type(screen.getByPlaceholderText(/enter email/i), 'recipient@example.com');
    await user.type(screen.getByPlaceholderText(/design review feedback/i), 'Real Test Subject');
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeInTheDocument();

    await user.click(sendButton);

    await waitFor(() => {
      expect(mockAgent.create).toHaveBeenCalledOnce();
      expect(mockAgent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [{ email: 'recipient@example.com', name: 'recipient' }],
          subject: 'Real Test Subject',
          fromEmail: expect.stringContaining('test@example.com'),
        }),
      );
    });
  });
});
