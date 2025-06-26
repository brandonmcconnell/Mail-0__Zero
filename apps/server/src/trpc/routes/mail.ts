import { activeDriverProcedure, createRateLimiterMiddleware, router } from '../trpc';
import { updateWritingStyleMatrix } from '../../services/writing-style-service';
import { deserializeFiles, serializedFileSchema } from '../../lib/schemas';
import { defaultPageSize, FOLDERS, LABELS } from '../../lib/utils';
import type { DeleteAllSpamResponse } from '../../types';
import { getZeroAgent } from '../../lib/server-utils';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { suggestContacts, upsertContacts } from '../../lib/contacts-cache';
import { scheduleContactsIndexing } from '../../lib/contacts-indexer';

const senderSchema = z.object({
  name: z.string().optional(),
  email: z.string(),
});

export const mailRouter = router({
  suggestRecipients: activeDriverProcedure
    .input(z.object({ query: z.string().optional().default(''), limit: z.number().optional().default(10) }))
    .query(async ({ ctx, input }) => {
      const { activeConnection } = ctx;
      
      const result = await suggestContacts(activeConnection.id, input.query, input.limit);
      
      if (result.length === 0) {
        ctx.c.executionCtx.waitUntil(scheduleContactsIndexing(activeConnection.id));
      }
      
      return await suggestContacts(activeConnection.id, input.query, input.limit);
    }),
  getRecipientSuggestions: activeDriverProcedure
    .input(
      z.object({
        query: z.string().optional().default(''),
        limit: z.number().optional().default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      const { query, limit } = input;
      
      const recipientEmails = new Map<string, { email: string; name?: string; frequency: number }>();

      const addRecipient = (email: string, name?: string, freq = 5) => {
        const key = email.toLowerCase();
        const existing = recipientEmails.get(key);
        recipientEmails.set(key, {
          email,
          name: name || existing?.name,
          frequency: (existing?.frequency || 0) + freq,
        });
      };

      addRecipient(activeConnection.email, activeConnection.name ?? undefined, 10);

      try {
        const aliases = await agent.getEmailAliases();
        aliases.forEach((alias: { email: string; name?: string | null; primary?: boolean }) => {
          addRecipient(alias.email, alias.name ?? undefined, alias.primary ? 9 : 8);
        });
      } catch (e) {
        console.warn('Failed to fetch email aliases:', e);
      }

      if (query.trim()) {
        const lowerQuery = query.toLowerCase().trim();
        const aliasMatches = Array.from(recipientEmails.values()).filter(
          (r) => r.email.toLowerCase().includes(lowerQuery) || (r.name && r.name.toLowerCase().includes(lowerQuery)),
        );
        if (aliasMatches.length >= limit) {
          aliasMatches.sort((a, b) => b.frequency - a.frequency || a.email.localeCompare(b.email));
          return aliasMatches.slice(0, limit).map(({ email, name }) => ({
            email,
            name,
            displayText: name ? `${name} <${email}>` : email,
          }));
        }
      }

      try {
        try {
          const sentEmails = await agent.list({
            folder: 'sent',
            query: '',
            maxResults: 50,
          });

          const threads = (sentEmails as any).threads || [];
          for (const thread of threads.slice(0, 25)) {
            try {
              const threadDetails = await agent.get(thread.id);
              
              for (const message of threadDetails.messages) {
                if (message.to) {
                  for (const recipient of message.to) {
                    if (recipient.email) {
                      const key = recipient.email.toLowerCase();
                      const existing = recipientEmails.get(key);
                      recipientEmails.set(key, {
                        email: recipient.email,
                        name: recipient.name || existing?.name,
                        frequency: (existing?.frequency || 0) + 2,
                      });
                    }
                  }
                }

                if (message.cc) {
                  for (const recipient of message.cc) {
                    if (recipient.email) {
                      const key = recipient.email.toLowerCase();
                      const existing = recipientEmails.get(key);
                      recipientEmails.set(key, {
                        email: recipient.email,
                        name: recipient.name || existing?.name,
                        frequency: (existing?.frequency || 0) + 1,
                      });
                    }
                  }
                }
              }
            } catch (error) {
              continue;
            }
          }
        } catch (error) {
          console.warn('Failed to fetch sent emails for recipient suggestions:', error);
        }

        try {
          const inboxEmails = await agent.list({
            folder: 'inbox',
            query: '',
            maxResults: 50,
          });

           const inboxThreads = (inboxEmails as any).threads || [];
           for (const thread of inboxThreads.slice(0, 25)) {
            try {
              const threadDetails = await agent.get(thread.id);
              
              for (const message of threadDetails.messages) {
                if (message.sender && message.sender.email) {
                  const key = message.sender.email.toLowerCase();
                  const existing = recipientEmails.get(key);
                  recipientEmails.set(key, {
                    email: message.sender.email,
                    name: message.sender.name || existing?.name,
                    frequency: (existing?.frequency || 0) + 1,
                  });
                }
              }
            } catch (error) {
              continue;
            }
          }
        } catch (error) {
          console.warn('Failed to fetch inbox emails for recipient suggestions:', error);
        }

        let recipients = Array.from(recipientEmails.values());

        if (query.trim()) {
          const lowerQuery = query.toLowerCase().trim();
          recipients = recipients.filter(
            (recipient) =>
              recipient.email.toLowerCase().includes(lowerQuery) ||
              (recipient.name && recipient.name.toLowerCase().includes(lowerQuery))
          );
        }

        recipients.sort((a, b) => {
          if (b.frequency !== a.frequency) {
            return b.frequency - a.frequency;
          }
          return a.email.localeCompare(b.email);
        });

        return recipients.slice(0, limit).map(({ email, name }) => ({
          email,
          name,
          displayText: name ? `${name} <${email}>` : email,
        }));
      } catch (error) {
        console.error('Error fetching recipient suggestions:', error);
      }
    }),
  get: activeDriverProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return await agent.getThread(input.id);
    }),
  count: activeDriverProcedure.query(async ({ ctx }) => {
    const { activeConnection } = ctx;
    const agent = await getZeroAgent(activeConnection.id);
    return await agent.count();
  }),
  listThreads: activeDriverProcedure
    .input(
      z.object({
        folder: z.string().optional().default('inbox'),
        q: z.string().optional().default(''),
        max: z.number().optional().default(defaultPageSize),
        cursor: z.string().optional().default(''),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { folder, max, cursor, q } = input;
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);

      if (folder === FOLDERS.DRAFT) {
        const drafts = await agent.listDrafts({
          q,
          maxResults: max,
          pageToken: cursor,
        });
        return drafts;
      }
      const threadsResponse = await agent.list({
        folder,
        query: q,
        maxResults: max,
        pageToken: cursor,
      });
      return threadsResponse;
    }),
  markAsRead: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.markAsRead(input.ids);
    }),
  markAsUnread: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.markAsUnread(input.ids);
    }),
  markAsImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['IMPORTANT'], []);
    }),
  modifyLabels: activeDriverProcedure
    .input(
      z.object({
        threadId: z.string().array(),
        addLabels: z.string().array().optional().default([]),
        removeLabels: z.string().array().optional().default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      const { threadId, addLabels, removeLabels } = input;

      console.log(`Server: updateThreadLabels called for thread ${threadId}`);
      console.log(`Adding labels: ${addLabels.join(', ')}`);
      console.log(`Removing labels: ${removeLabels.join(', ')}`);

      const result = await agent.normalizeIds(threadId);
      const { threadIds } = result;

      if (threadIds.length) {
        await agent.modifyLabels(threadIds, addLabels, removeLabels);
        console.log('Server: Successfully updated thread labels');
        return { success: true };
      }

      console.log('Server: No label changes specified');
      return { success: false, error: 'No label changes specified' };
    }),

  toggleStar: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      const { threadIds } = await agent.normalizeIds(input.ids);

      if (!threadIds.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const threadResults: PromiseSettledResult<{ messages: { tags: { name: string }[] }[] }>[] =
        await Promise.allSettled(threadIds.map((id) => agent.get(id)));

      let anyStarred = false;
      let processedThreads = 0;

      for (const result of threadResults) {
        if (result.status === 'fulfilled' && result.value && result.value.messages.length > 0) {
          processedThreads++;
          const isThreadStarred = result.value.messages.some((message) =>
            message.tags?.some((tag) => tag.name.toLowerCase().startsWith('starred')),
          );
          if (isThreadStarred) {
            anyStarred = true;
            break;
          }
        }
      }

      const shouldStar = processedThreads > 0 && !anyStarred;

      await agent.modifyLabels(
        threadIds,
        shouldStar ? ['STARRED'] : [],
        shouldStar ? [] : ['STARRED'],
      );

      return { success: true };
    }),
  toggleImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      const { threadIds } = await agent.normalizeIds(input.ids);

      if (!threadIds.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const threadResults: PromiseSettledResult<{ messages: { tags: { name: string }[] }[] }>[] =
        await Promise.allSettled(threadIds.map((id) => agent.get(id)));

      let anyImportant = false;
      let processedThreads = 0;

      for (const result of threadResults) {
        if (result.status === 'fulfilled' && result.value && result.value.messages.length > 0) {
          processedThreads++;
          const isThreadImportant = result.value.messages.some((message) =>
            message.tags?.some((tag) => tag.name.toLowerCase().startsWith('important')),
          );
          if (isThreadImportant) {
            anyImportant = true;
            break;
          }
        }
      }

      const shouldMarkImportant = processedThreads > 0 && !anyImportant;

      await agent.modifyLabels(
        threadIds,
        shouldMarkImportant ? ['IMPORTANT'] : [],
        shouldMarkImportant ? [] : ['IMPORTANT'],
      );

      return { success: true };
    }),
  bulkStar: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['STARRED'], []);
    }),
  bulkMarkImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['IMPORTANT'], []);
    }),
  bulkUnstar: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, [], ['STARRED']);
    }),
  deleteAllSpam: activeDriverProcedure.mutation(async ({ ctx }): Promise<DeleteAllSpamResponse> => {
    const { activeConnection } = ctx;
    const agent = await getZeroAgent(activeConnection.id);
    try {
      return await agent.deleteAllSpam();
    } catch (error) {
      console.error('Error deleting spam emails:', error);
      return {
        success: false,
        message: 'Failed to delete spam emails',
        error: String(error),
        count: 0,
      };
    }
  }),
  bulkUnmarkImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, [], ['IMPORTANT']);
    }),

  send: activeDriverProcedure
    .input(
      z.object({
        to: z.array(senderSchema),
        subject: z.string(),
        message: z.string(),
        attachments: z
          .array(serializedFileSchema)
          .transform(deserializeFiles)
          .optional()
          .default([]),
        headers: z.record(z.string()).optional().default({}),
        cc: z.array(senderSchema).optional(),
        bcc: z.array(senderSchema).optional(),
        threadId: z.string().optional(),
        fromEmail: z.string().optional(),
        draftId: z.string().optional(),
        isForward: z.boolean().optional(),
        originalMessage: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      const { draftId, ...mail } = input;

      const afterTask = async () => {
        try {
          console.warn('Saving writing style matrix...');
          await updateWritingStyleMatrix(activeConnection.id, input.message);
          console.warn('Saved writing style matrix.');
        } catch (error) {
          console.error('Failed to save writing style matrix', error);
        }
      };

      if (draftId) {
        await agent.sendDraft(draftId, mail);
      } else {
        await agent.create(input);
      }

      // Asynchronously update contacts cache
      const contactsToAdd = [...input.to, ...(input.cc ?? []), ...(input.bcc ?? [])];
      ctx.c.executionCtx.waitUntil(upsertContacts(activeConnection.id, contactsToAdd));

      ctx.c.executionCtx.waitUntil(afterTask());
      return { success: true };
    }),
  delete: activeDriverProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.delete(input.id);
    }),
  bulkDelete: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['TRASH'], []);
    }),
  bulkArchive: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, [], ['INBOX']);
    }),
  bulkMute: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['MUTE'], []);
    }),
  getEmailAliases: activeDriverProcedure.query(async ({ ctx }) => {
    const { activeConnection } = ctx;
    const agent = await getZeroAgent(activeConnection.id);
    return agent.getEmailAliases();
  }),
});
