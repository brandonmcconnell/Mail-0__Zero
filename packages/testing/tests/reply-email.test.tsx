import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, mockEmailData, mockConnection, mockSettings, createTestCaller } from '../utils/test-utils';
import { mockAgent } from '../setup';
import ReplyCompose from '@zero/mail/components/mail/reply-composer';
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

vi.mock('@zero/mail/hooks/use-thread', () => ({
  useThread: () => ({
    data: mockEmailData,
    refetch: vi.fn(),
  }),
}));

vi.mock('nuqs', () => ({
  useQueryState: vi.fn((key: string) => {
    if (key === 'mode') return ['reply', vi.fn()];
    return [null, vi.fn()];
  }),
}));

describe('Real <ReplyCompose /> Integration Test', () => {
  const user = userEvent.setup();
  const queryClient = new QueryClient();

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ReplyCompose messageId="test-message-id" />
      </QueryClientProvider>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('should render the component and send a reply', async () => {
    renderComponent();

    const testCaller = createTestCaller();
    
    const replyData = {
      to: [{ email: 'john@example.com', name: 'John Doe' }],
      subject: 'Re: Test Email Subject',
      message: 'This is a reply message',
      headers: {
        'In-Reply-To': 'test-message-id',
        References: 'test-message-id',
      },
      threadId: 'test-thread-id',
    };

    await testCaller.mail.send(replyData);

    expect(mockAgent.create).toHaveBeenCalledOnce();
    expect(mockAgent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Re: Test Email Subject',
        to: [{ email: 'john@example.com', name: 'John Doe' }],
        headers: expect.objectContaining({
          'In-Reply-To': 'test-message-id',
          References: 'test-message-id',
        }),
      }),
    );
  });
});
