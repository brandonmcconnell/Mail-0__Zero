import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@zero/server/db';
import { eq } from 'drizzle-orm';
import { mailRouter } from '@zero/server/trpc/routes/mail';
import { router } from '@zero/server/trpc/trpc';

// Mock the Zero agent for testing
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
        tags: [{ name: 'STARRED' }]
      }
    ]
  }),
  markAsRead: vi.fn().mockResolvedValue({ success: true }),
  markAsUnread: vi.fn().mockResolvedValue({ success: true }),
  delete: vi.fn().mockResolvedValue({ success: true }),
  deleteAllSpam: vi.fn().mockResolvedValue({
    success: true,
    count: 5,
    message: 'Deleted 5 spam emails'
  }),
};

// Mock getZeroAgent
vi.mock('@zero/server/lib/agent', () => ({
  getZeroAgent: vi.fn().mockResolvedValue(mockAgent),
}));

// Mock writing style matrix update
vi.mock('@zero/server/services/writing-style-service', () => ({
  updateWritingStyleMatrix: vi.fn().mockResolvedValue(undefined),
}));

// Create test context
const createTestContext = () => ({
  activeConnection: {
    id: 'test-connection-id',
    name: 'Test Connection',
    email: 'test@example.com',
  },
  c: {
    executionCtx: {
      waitUntil: vi.fn(),
    },
  },
});

// Create test router
const testRouter = router({
  mail: mailRouter,
});

type TestRouter = typeof testRouter;

describe('Server Mail Integration Tests', () => {
  const testContext = createTestContext();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('send', () => {
    it('should send email through agent.create', async () => {
      const caller = testRouter.createCaller(testContext);

      const emailData = {
        to: [{ email: 'recipient@example.com', name: 'Recipient' }],
        subject: 'Test Email',
        message: 'This is a test email',
        attachments: [],
        headers: {},
        fromEmail: 'Test User <test@example.com>',
      };

      const result = await caller.mail.send(emailData);

      expect(result).toEqual({ success: true });
      expect(mockAgent.create).toHaveBeenCalledWith(emailData);
      expect(mockAgent.sendDraft).not.toHaveBeenCalled();
    });

    it('should send draft when draftId is provided', async () => {
      const caller = testRouter.createCaller(testContext);

      const emailData = {
        to: [{ email: 'recipient@example.com', name: 'Recipient' }],
        subject: 'Test Draft',
        message: 'This is a draft email',
        attachments: [],
        headers: {},
        draftId: 'test-draft-id',
        fromEmail: 'test@example.com',
      };

      const result = await caller.mail.send(emailData);

      expect(result).toEqual({ success: true });
      expect(mockAgent.sendDraft).toHaveBeenCalledWith('test-draft-id', {
        to: emailData.to,
        subject: emailData.subject,
        message: emailData.message,
        attachments: emailData.attachments,
        headers: emailData.headers,
        fromEmail: emailData.fromEmail,
      });
      expect(mockAgent.create).not.toHaveBeenCalled();
    });

    it('should include CC and BCC recipients', async () => {
      const caller = testRouter.createCaller(testContext);

      const emailData = {
        to: [{ email: 'to@example.com', name: 'To User' }],
        cc: [{ email: 'cc@example.com', name: 'CC User' }],
        bcc: [{ email: 'bcc@example.com', name: 'BCC User' }],
        subject: 'Test Email with CC/BCC',
        message: 'Test message',
        attachments: [],
        headers: {},
        fromEmail: 'test@example.com',
      };

      await caller.mail.send(emailData);

      expect(mockAgent.create).toHaveBeenCalledWith(emailData);
    });

    it('should handle forward emails', async () => {
      const caller = testRouter.createCaller(testContext);

      const emailData = {
        to: [{ email: 'recipient@example.com', name: 'Recipient' }],
        subject: 'Fwd: Original Subject',
        message: 'Forwarded message',
        attachments: [],
        headers: {},
        isForward: true,
        originalMessage: 'Original email content',
        fromEmail: 'test@example.com',
      };

      await caller.mail.send(emailData);

      expect(mockAgent.create).toHaveBeenCalledWith(emailData);
    });

    it('should handle reply emails with threading', async () => {
      const caller = testRouter.createCaller(testContext);

      const emailData = {
        to: [{ email: 'original-sender@example.com', name: 'Original Sender' }],
        subject: 'Re: Original Subject',
        message: 'Reply message',
        attachments: [],
        headers: {
          'In-Reply-To': '<original-message-id@example.com>',
          'References': '<original-message-id@example.com>',
        },
        threadId: 'original-thread-id',
        fromEmail: 'test@example.com',
      };

      await caller.mail.send(emailData);

      expect(mockAgent.create).toHaveBeenCalledWith(emailData);
    });
  });

  describe('toggleStar', () => {
    it('should star unstarred emails', async () => {
      // Mock unstarred thread
      mockAgent.getThread.mockResolvedValueOnce({
        messages: [{ tags: [] }] // No STARRED tag
      });

      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.toggleStar({
        ids: ['thread-1']
      });

      expect(result).toEqual({ success: true });
      expect(mockAgent.normalizeIds).toHaveBeenCalledWith(['thread-1']);
      expect(mockAgent.getThread).toHaveBeenCalled();
      expect(mockAgent.modifyLabels).toHaveBeenCalledWith(
        ['normalized-thread-1', 'normalized-thread-2'],
        ['STARRED'], // Add STARRED
        [] // Remove nothing
      );
    });

    it('should unstar starred emails', async () => {
      // Mock starred thread
      mockAgent.getThread.mockResolvedValueOnce({
        messages: [{ tags: [{ name: 'STARRED' }] }]
      });

      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.toggleStar({
        ids: ['thread-1']
      });

      expect(result).toEqual({ success: true });
      expect(mockAgent.modifyLabels).toHaveBeenCalledWith(
        ['normalized-thread-1', 'normalized-thread-2'],
        [], // Add nothing
        ['STARRED'] // Remove STARRED
      );
    });

    it('should handle empty thread IDs', async () => {
      mockAgent.normalizeIds.mockResolvedValueOnce({ threadIds: [] });

      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.toggleStar({
        ids: ['non-existent-thread']
      });

      expect(result).toEqual({ 
        success: false, 
        error: 'No thread IDs provided' 
      });
    });
  });

  describe('bulkStar', () => {
    it('should star multiple emails', async () => {
      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.bulkStar({
        ids: ['thread-1', 'thread-2', 'thread-3']
      });

      expect(result).toEqual({ success: true });
      expect(mockAgent.modifyLabels).toHaveBeenCalledWith(
        ['thread-1', 'thread-2', 'thread-3'],
        ['STARRED'],
        []
      );
    });
  });

  describe('bulkUnstar', () => {
    it('should unstar multiple emails', async () => {
      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.bulkUnstar({
        ids: ['thread-1', 'thread-2']
      });

      expect(result).toEqual({ success: true });
      expect(mockAgent.modifyLabels).toHaveBeenCalledWith(
        ['thread-1', 'thread-2'],
        [],
        ['STARRED']
      );
    });
  });

  describe('bulkArchive', () => {
    it('should archive multiple emails', async () => {
      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.bulkArchive({
        ids: ['thread-1', 'thread-2']
      });

      expect(result).toEqual({ success: true });
      expect(mockAgent.modifyLabels).toHaveBeenCalledWith(
        ['thread-1', 'thread-2'],
        ['ARCHIVED'],
        []
      );
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple emails', async () => {
      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.bulkDelete({
        ids: ['thread-1', 'thread-2']
      });

      expect(result).toEqual({ success: true });
      expect(mockAgent.modifyLabels).toHaveBeenCalledWith(
        ['thread-1', 'thread-2'],
        ['TRASH'],
        []
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark emails as read', async () => {
      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.markAsRead({
        ids: ['thread-1', 'thread-2']
      });

      expect(result).toEqual({ success: true });
      expect(mockAgent.markAsRead).toHaveBeenCalledWith(['thread-1', 'thread-2']);
    });
  });

  describe('markAsUnread', () => {
    it('should mark emails as unread', async () => {
      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.markAsUnread({
        ids: ['thread-1']
      });

      expect(result).toEqual({ success: true });
      expect(mockAgent.markAsUnread).toHaveBeenCalledWith(['thread-1']);
    });
  });

  describe('markAsImportant', () => {
    it('should mark emails as important', async () => {
      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.markAsImportant({
        ids: ['thread-1']
      });

      expect(result).toEqual({ success: true });
      expect(mockAgent.modifyLabels).toHaveBeenCalledWith(
        ['thread-1'],
        ['IMPORTANT'],
        []
      );
    });
  });

  describe('toggleImportant', () => {
    it('should toggle important status', async () => {
      // Mock unimportant thread
      mockAgent.getThread.mockResolvedValueOnce({
        messages: [{ tags: [] }]
      });

      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.toggleImportant({
        ids: ['thread-1']
      });

      expect(result).toEqual({ success: true });
      expect(mockAgent.modifyLabels).toHaveBeenCalledWith(
        ['normalized-thread-1', 'normalized-thread-2'],
        ['IMPORTANT'],
        []
      );
    });
  });

  describe('delete', () => {
    it('should delete a single email', async () => {
      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.delete({
        id: 'thread-1'
      });

      expect(result).toEqual({ success: true });
      expect(mockAgent.delete).toHaveBeenCalledWith('thread-1');
    });
  });

  describe('deleteAllSpam', () => {
    it('should delete all spam emails', async () => {
      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.deleteAllSpam();

      expect(result).toEqual({
        success: true,
        count: 5,
        message: 'Deleted 5 spam emails'
      });
      expect(mockAgent.deleteAllSpam).toHaveBeenCalled();
    });

    it('should handle delete all spam errors', async () => {
      mockAgent.deleteAllSpam.mockRejectedValueOnce(new Error('Connection failed'));

      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.deleteAllSpam();

      expect(result).toEqual({
        success: false,
        message: 'Failed to delete spam emails',
        error: 'Error: Connection failed',
        count: 0
      });
    });
  });

  describe('updateThreadLabels', () => {
    it('should add and remove labels', async () => {
      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.updateThreadLabels({
        threadId: ['thread-1'],
        addLabels: ['IMPORTANT', 'WORK'],
        removeLabels: ['PERSONAL']
      });

      expect(result).toEqual({ success: true });
      expect(mockAgent.normalizeIds).toHaveBeenCalledWith(['thread-1']);
      expect(mockAgent.modifyLabels).toHaveBeenCalledWith(
        ['normalized-thread-1', 'normalized-thread-2'],
        ['IMPORTANT', 'WORK'],
        ['PERSONAL']
      );
    });

    it('should return error when no thread IDs are found', async () => {
      mockAgent.normalizeIds.mockResolvedValueOnce({ threadIds: [] });

      const caller = testRouter.createCaller(testContext);

      const result = await caller.mail.updateThreadLabels({
        threadId: ['invalid-thread'],
        addLabels: ['LABEL'],
        removeLabels: []
      });

      expect(result).toEqual({
        success: false,
        error: 'No label changes specified'
      });
    });
  });

  describe('error handling', () => {
    it('should handle agent connection errors', async () => {
      // Mock getZeroAgent to throw an error
      const mockGetZeroAgent = vi.mocked(require('@zero/server/lib/agent').getZeroAgent);
      mockGetZeroAgent.mockRejectedValueOnce(new Error('Agent connection failed'));

      const caller = testRouter.createCaller(testContext);

      await expect(caller.mail.send({
        to: [{ email: 'test@example.com', name: 'Test' }],
        subject: 'Test',
        message: 'Test',
        attachments: [],
        headers: {},
        fromEmail: 'sender@example.com',
      })).rejects.toThrow('Agent connection failed');
    });

    it('should handle agent method failures', async () => {
      mockAgent.create.mockRejectedValueOnce(new Error('Send failed'));

      const caller = testRouter.createCaller(testContext);

      await expect(caller.mail.send({
        to: [{ email: 'test@example.com', name: 'Test' }],
        subject: 'Test',
        message: 'Test',
        attachments: [],
        headers: {},
        fromEmail: 'sender@example.com',
      })).rejects.toThrow('Send failed');
    });
  });
});