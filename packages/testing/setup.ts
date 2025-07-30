import '@testing-library/jest-dom';
import { beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';

const mockAgent = {
  create: vi.fn().mockResolvedValue({ success: true }),
  sendDraft: vi.fn().mockResolvedValue({ success: true }),
  modifyLabels: vi.fn().mockResolvedValue({ success: true }),
  normalizeIds: vi.fn().mockResolvedValue({ 
    threadIds: ['normalized-thread-1', 'normalized-thread-2'] 
  }),
  getThread: vi.fn().mockResolvedValue({
    messages: [
      {
        id: 'msg-1',
        subject: 'Test Subject',
        tags: [{ name: 'UNREAD' }],
        sender: { email: 'sender@example.com', name: 'Test Sender' },
        to: [{ email: 'test@example.com', name: 'Test User' }],
        decodedBody: '<p>Test message body</p>',
        receivedOn: new Date().toISOString(),
        messageId: 'msg-123',
        threadId: 'thread-123',
        references: ''
      }
    ]
  }),
  markAsRead: vi.fn().mockResolvedValue({ success: true }),
  markAsUnread: vi.fn().mockResolvedValue({ success: true }),
  delete: vi.fn().mockResolvedValue({ success: true }),
  count: vi.fn().mockResolvedValue([
    { label: 'INBOX', count: 10 },
    { label: 'SENT', count: 5 }
  ]),
  listThreads: vi.fn().mockResolvedValue({
    threads: [],
    nextPageToken: null
  })
};

vi.mock('@zero/server/lib/server-utils', () => ({
  getZeroAgent: vi.fn().mockResolvedValue(mockAgent),
  getActiveConnection: vi.fn().mockResolvedValue({
    id: 'test-connection-id',
    email: 'test@example.com',
    name: 'Test User',
  }),
  getZeroDB: vi.fn().mockReturnValue({}),
}));

vi.mock('@zero/server/services/writing-style-service', () => ({
  updateWritingStyleMatrix: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('cloudflare:workers', () => ({
  env: {
    DB: {},
    snoozed_emails: {
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

export { mockAgent };

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
    identify: vi.fn(),
    init: vi.fn(),
  },
}));

vi.mock('jotai', () => ({
  useAtom: vi.fn(() => [null, vi.fn()]),
  atom: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('nuqs', () => ({
  useQueryState: vi.fn((key: string, options?: any) => [
    options?.defaultValue || null,
    vi.fn(),
  ]),
}));

vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
      },
    },
  }),
}));





const server = setupServer(
  http.post('/api/trpc/mail.send', () => {
    return HttpResponse.json({ result: { data: { success: true } } });
  }),
  http.post('/api/trpc/mail.toggleStar', () => {
    return HttpResponse.json({ result: { data: { success: true } } });
  }),
  http.get('/api/trpc/connections.getDefault', () => {
    return HttpResponse.json({
      result: {
        data: {
          id: 'test-connection-id',
          email: 'test@example.com',
          name: 'Test User',
        },
      },
    });
  }),
  http.get('/api/trpc/settings.get', () => {
    return HttpResponse.json({
      result: {
        data: {
          settings: {
            zeroSignature: true,
          },
        },
      },
    });
  })
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
});

export { server };