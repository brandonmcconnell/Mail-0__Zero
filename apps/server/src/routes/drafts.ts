import { getZeroAgent } from '../lib/server-utils';
import { connection } from '../db/schema';
import type { HonoContext } from '../ctx';
import { env } from 'cloudflare:workers';
import { eq, and } from 'drizzle-orm';
import { createDb } from '../db';
import { Hono } from 'hono';
import { z } from 'zod';

const draftsRouter = new Hono<HonoContext>();

draftsRouter.use('*', async (c, next) => {
  const sessionUser = c.get('sessionUser');
  if (!sessionUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

const cleanupDraftsSchema = z.object({
  threadId: z.string().min(1, 'Thread ID is required'),
  connectionId: z.string().min(1, 'Connection ID is required'),
  maxDrafts: z.number().int().positive().default(3),
});

interface DraftInfo {
  id: string;
  threadId: string;
  subject?: string;
  createdAt?: string;
}

draftsRouter.post('/cleanup', async (c) => {
  try {
    const body = await c.req.json();
    const validation = cleanupDraftsSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: 'Invalid request parameters',
          details: validation.error.flatten(),
        },
        400,
      );
    }

    const { threadId, connectionId, maxDrafts } = validation.data;
    const sessionUser = c.get('sessionUser');

    const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
    const userConnection = await db.query.connection.findFirst({
      where: and(eq(connection.id, connectionId), eq(connection.userId, sessionUser!.id)),
    });

    c.executionCtx.waitUntil(conn.end());

    if (!userConnection) {
      return c.json({ error: 'Connection not found or unauthorized' }, 404);
    }

    const agent = await getZeroAgent(connectionId);

    const allDrafts: DraftInfo[] = [];
    let pageToken: string | undefined = undefined;

    console.log(`[CLEANUP_DRAFTS] Starting cleanup for thread ${threadId}`);

    do {
      const draftsResponse = await agent.listDrafts({
        maxResults: 100,
        pageToken: pageToken || undefined,
      });

      if (!draftsResponse || typeof draftsResponse !== 'object' || !('threads' in draftsResponse)) {
        console.error('[CLEANUP_DRAFTS] Unexpected draft response structure:', draftsResponse);
        break;
      }

      // @ts-expect-error - TODO: fix this
      const threads = draftsResponse.threads;
      for (const draft of threads || []) {
        try {
          const draftDetails = await agent.getDraft(draft.id);
          const details = draftDetails as any;
          if (details.threadId === threadId) {
            allDrafts.push({
              id: draft.id,
              threadId: details.threadId,
              subject: details.subject,
              createdAt: details.date || details.rawMessage?.internalDate,
            });
          }
        } catch (error) {
          console.error(`[CLEANUP_DRAFTS] Error getting draft details for ${draft.id}:`, error);
        }
      }

      pageToken = (draftsResponse as any).nextPageToken || undefined;
    } while (pageToken);

    console.log(`[CLEANUP_DRAFTS] Found ${allDrafts.length} drafts for thread ${threadId}`);

    if (allDrafts.length <= maxDrafts) {
      return c.json({
        success: true,
        message: `Thread has ${allDrafts.length} drafts, no cleanup needed (max: ${maxDrafts})`,
        threadId,
        totalDrafts: allDrafts.length,
        deletedDrafts: 0,
        keptDrafts: allDrafts.length,
      });
    }

    allDrafts.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const draftsToKeep = allDrafts.slice(0, maxDrafts);
    const draftsToDelete = allDrafts.slice(maxDrafts);

    console.log(
      `[CLEANUP_DRAFTS] Keeping ${draftsToKeep.length} drafts, deleting ${draftsToDelete.length} drafts`,
    );

    const deletedDrafts: string[] = [];
    const failedDeletes: { id: string; error: string }[] = [];

    for (const draft of draftsToDelete) {
      try {
        const driverAgent = agent as any;
        if (driverAgent.deleteDraft) {
          await driverAgent.deleteDraft(draft.id);
        } else {
          await agent.delete(draft.id);
        }
        deletedDrafts.push(draft.id);
        console.log(`[CLEANUP_DRAFTS] ✓ Deleted draft ${draft.id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[CLEANUP_DRAFTS] ✗ Failed to delete draft ${draft.id}:`, error);
        failedDeletes.push({ id: draft.id, error: errorMessage });
      }
    }

    return c.json({
      success: true,
      message: `Cleaned up drafts for thread ${threadId}`,
      threadId,
      totalDrafts: allDrafts.length,
      deletedDrafts: deletedDrafts.length,
      keptDrafts: draftsToKeep.length,
      deletedDraftIds: deletedDrafts,
      failedDeletes: failedDeletes.length > 0 ? failedDeletes : undefined,
    });
  } catch (error) {
    console.error('[CLEANUP_DRAFTS] Error in cleanup endpoint:', error);
    return c.json(
      {
        error: 'Failed to cleanup drafts',
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

export { draftsRouter };
