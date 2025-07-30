import { ReactElement, PropsWithChildren } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mailRouter } from '@zero/server/trpc/routes/mail';
import { router } from '@zero/server/trpc/trpc';

export const mockEmailData = {
  id: 'test-thread-id',
  messages: [
    {
      id: 'test-message-id',
      sender: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      to: [
        {
          name: 'Test User',
          email: 'test@example.com',
        },
      ],
      subject: 'Test Email Subject',
      decodedBody: '<p>This is a test email body</p>',
      receivedOn: '2024-01-01T12:00:00Z',
      threadId: 'test-thread-id',
      messageId: 'test-message-id',
      tags: [],
      cc: [],
      bcc: [],
      references: '',
    },
  ],
  latest: {
    id: 'test-message-id',
    sender: {
      name: 'John Doe',
      email: 'john@example.com',
    },
    to: [
      {
        name: 'Test User',
        email: 'test@example.com',
      },
    ],
    subject: 'Test Email Subject',
    decodedBody: '<p>This is a test email body</p>',
    receivedOn: '2024-01-01T12:00:00Z',
    threadId: 'test-thread-id',
    messageId: 'test-message-id',
    tags: [],
    cc: [],
    bcc: [],
    references: '',
  },
};

export const mockConnection = {
  id: 'test-connection-id',
  email: 'test@example.com',
  name: 'Test User',
  provider: 'google',
};

export const mockSettings = {
  settings: {
    zeroSignature: true,
  },
};

const createTestContext = (): any => ({
  activeConnection: {
    id: 'test-connection-id',
    name: 'Test Connection',
    email: 'test@example.com',
  },
  sessionUser: { id: 'test-user' },
  c: {
    executionCtx: { waitUntil: vi.fn() },
    var: { auth: { api: { signOut: vi.fn() } } },
    req: { raw: { headers: new Headers() } },
  },
});

export const testRouter = router({
  mail: mailRouter,
});

const createTestCaller = () => testRouter.createCaller(createTestContext());

export const createMockHooks = () => ({
  useSession: vi.fn(() => ({
    data: {
      user: {
        name: 'Test User',
        email: 'test@example.com',
      },
    },
  })),
  useActiveConnection: vi.fn(() => ({
    data: mockConnection,
  })),
  useSettings: vi.fn(() => ({
    data: mockSettings,
    isLoading: false,
  })),
  useThread: vi.fn(() => ({
    data: mockEmailData,
    refetch: vi.fn(),
    latestDraft: null,
  })),
  useEmailAliases: vi.fn(() => ({
    data: [
      {
        email: 'alias@example.com',
        primary: false,
      },
    ],
  })),
  useDraft: vi.fn(() => ({
    data: null,
  })),
});

vi.mock('@zero/mail/providers/query-provider', () => {
  const testCaller = createTestCaller();
  
  return {
    useTRPC: () => ({
      mail: {
        send: {
          mutationOptions: () => ({
            mutationFn: testCaller.mail.send,
          }),
        },
        toggleStar: {
          mutationOptions: () => ({
            mutationFn: testCaller.mail.toggleStar,
          }),
        },
        get: {
          queryOptions: (input: any) => ({
            queryKey: ['mail.get', input],
            queryFn: () => testCaller.mail.get(input),
          }),
        },
        processEmailContent: {
          mutationOptions: () => ({
            mutationFn: vi.fn().mockResolvedValue({ processedHtml: '<p>processed</p>', hasBlockedImages: false }),
          }),
        },
        listThreads: {
          queryOptions: () => ({
            queryKey: ['mail.listThreads'],
            queryFn: () => testCaller.mail.listThreads({ folder: 'inbox' }),
          }),
        },
      },
      drafts: {
        get: {
          queryOptions: (input: any) => ({
            queryKey: ['drafts.get', input],
            queryFn: () => vi.fn().mockResolvedValue(null)(),
            enabled: false,
          }),
        },
        create: {
          mutationOptions: () => ({
            mutationFn: vi.fn().mockResolvedValue({ id: 'draft-123' }),
          }),
        },
      },
      ai: {
        compose: {
          mutationOptions: () => ({
            mutationFn: vi.fn().mockResolvedValue({ newBody: 'AI generated content' }),
          }),
        },
        generateEmailSubject: {
          mutationOptions: () => ({
            mutationFn: vi.fn().mockResolvedValue({ subject: 'AI generated subject' }),
          }),
        },
      },
      connections: {
        getDefault: {
          queryOptions: () => ({
            queryKey: ['connections.getDefault'],
            queryFn: () => vi.fn().mockResolvedValue(mockConnection)(),
          }),
        },
      },
      settings: {
        get: {
          queryOptions: () => ({
            queryKey: ['settings.get'],
            queryFn: () => vi.fn().mockResolvedValue(mockSettings)(),
          }),
        },
      },
    }),
    useTRPCClient: () => ({
      mail: {
        send: {
          mutate: testCaller.mail.send,
        },
        toggleStar: {
          mutate: testCaller.mail.toggleStar,
        },
      },
    }),
  };
});

function TestWrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children as any}
    </QueryClientProvider>
  );
}

const customRender = (ui: ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: TestWrapper, ...options });

export * from '@testing-library/react';
export { customRender as render, TestWrapper, createTestCaller };