import { subscriptions, subscriptionThreads } from '../../db/schema';
import { getListUnsubscribeAction } from '../../lib/email-utils';
import { router, publicProcedure } from '../trpc';
import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createDb } from '../../db';
import { z } from 'zod';

export const subscriptionsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        connectionId: z.string().optional(),
        category: z
          .enum(['newsletter', 'promotional', 'social', 'development', 'transactional', 'general'])
          .optional(),
        isActive: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { db, conn } = createDb(ctx.env.HYPERDRIVE.connectionString);

      try {
        const conditions = [eq(subscriptions.userId, input.userId)];

        if (input.connectionId) {
          conditions.push(eq(subscriptions.connectionId, input.connectionId));
        }

        if (input.category) {
          conditions.push(eq(subscriptions.category, input.category));
        }

        if (input.isActive !== undefined) {
          conditions.push(eq(subscriptions.isActive, input.isActive));
        }

        const [items, totalResult] = await Promise.all([
          db
            .select({
              id: subscriptions.id,
              senderEmail: subscriptions.senderEmail,
              senderName: subscriptions.senderName,
              senderDomain: subscriptions.senderDomain,
              category: subscriptions.category,
              listUnsubscribeUrl: subscriptions.listUnsubscribeUrl,
              listUnsubscribePost: subscriptions.listUnsubscribePost,
              lastEmailReceivedAt: subscriptions.lastEmailReceivedAt,
              emailCount: subscriptions.emailCount,
              isActive: subscriptions.isActive,
              userUnsubscribedAt: subscriptions.userUnsubscribedAt,
              autoArchive: subscriptions.autoArchive,
              metadata: subscriptions.metadata,
              createdAt: subscriptions.createdAt,
            })
            .from(subscriptions)
            .where(and(...conditions))
            .orderBy(desc(subscriptions.lastEmailReceivedAt))
            .limit(input.limit)
            .offset(input.offset),
          db
            .select({ count: sql<number>`count(*)` })
            .from(subscriptions)
            .where(and(...conditions)),
        ]);

        const total = totalResult[0]?.count || 0;

        return {
          items,
          total,
          hasMore: input.offset + items.length < total,
        };
      } finally {
        await conn.end();
      }
    }),

  get: publicProcedure
    .input(
      z.object({
        subscriptionId: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { db, conn } = createDb(ctx.env.HYPERDRIVE.connectionString);

      try {
        const [subscription] = await db
          .select()
          .from(subscriptions)
          .where(
            and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.userId, input.userId)),
          );

        if (!subscription) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Subscription not found',
          });
        }

        // Get recent threads
        const recentThreads = await db
          .select({
            threadId: subscriptionThreads.threadId,
            messageId: subscriptionThreads.messageId,
            receivedAt: subscriptionThreads.receivedAt,
            subject: subscriptionThreads.subject,
          })
          .from(subscriptionThreads)
          .where(eq(subscriptionThreads.subscriptionId, input.subscriptionId))
          .orderBy(desc(subscriptionThreads.receivedAt))
          .limit(10);

        return {
          ...subscription,
          recentThreads,
        };
      } finally {
        await conn.end();
      }
    }),

  unsubscribe: publicProcedure
    .input(
      z.object({
        subscriptionId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { db, conn } = createDb(ctx.env.HYPERDRIVE.connectionString);

      try {
        // Get subscription details
        const [subscription] = await db
          .select()
          .from(subscriptions)
          .where(
            and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.userId, input.userId)),
          );

        if (!subscription) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Subscription not found',
          });
        }

        // Update subscription as inactive
        await db
          .update(subscriptions)
          .set({
            isActive: false,
            userUnsubscribedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, input.subscriptionId));

        // If there's a List-Unsubscribe header, return the action
        let unsubscribeAction = null;
        if (subscription.listUnsubscribeUrl) {
          unsubscribeAction = getListUnsubscribeAction({
            listUnsubscribe: subscription.listUnsubscribeUrl,
            listUnsubscribePost: subscription.listUnsubscribePost || undefined,
          });
        }

        return {
          success: true,
          unsubscribeAction,
        };
      } finally {
        await conn.end();
      }
    }),

  updatePreferences: publicProcedure
    .input(
      z.object({
        subscriptionId: z.string(),
        userId: z.string(),
        autoArchive: z.boolean().optional(),
        category: z
          .enum(['newsletter', 'promotional', 'social', 'development', 'transactional', 'general'])
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { db, conn } = createDb(ctx.env.HYPERDRIVE.connectionString);

      try {
        const updateData: any = {
          updatedAt: new Date(),
        };

        if (input.autoArchive !== undefined) {
          updateData.autoArchive = input.autoArchive;
        }

        if (input.category) {
          updateData.category = input.category;
        }

        await db
          .update(subscriptions)
          .set(updateData)
          .where(
            and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.userId, input.userId)),
          );

        return { success: true };
      } finally {
        await conn.end();
      }
    }),

  resubscribe: publicProcedure
    .input(
      z.object({
        subscriptionId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { db, conn } = createDb(ctx.env.HYPERDRIVE.connectionString);

      try {
        await db
          .update(subscriptions)
          .set({
            isActive: true,
            userUnsubscribedAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.userId, input.userId)),
          );

        return { success: true };
      } finally {
        await conn.end();
      }
    }),

  stats: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        connectionId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { db, conn } = createDb(ctx.env.HYPERDRIVE.connectionString);

      try {
        const conditions = [eq(subscriptions.userId, input.userId)];

        if (input.connectionId) {
          conditions.push(eq(subscriptions.connectionId, input.connectionId));
        }

        // Get stats by category
        const categoryStats = await db
          .select({
            category: subscriptions.category,
            count: sql<number>`count(*)`,
            activeCount: sql<number>`count(*) filter (where ${subscriptions.isActive} = true)`,
          })
          .from(subscriptions)
          .where(and(...conditions))
          .groupBy(subscriptions.category);

        // Get overall stats
        const [overallStats] = await db
          .select({
            total: sql<number>`count(*)`,
            active: sql<number>`count(*) filter (where ${subscriptions.isActive} = true)`,
            inactive: sql<number>`count(*) filter (where ${subscriptions.isActive} = false)`,
            avgEmailsPerSubscription: sql<number>`avg(${subscriptions.emailCount})`,
          })
          .from(subscriptions)
          .where(and(...conditions));

        // Get recent activity
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [recentActivity] = await db
          .select({
            recentlyReceived: sql<number>`count(*) filter (where ${subscriptions.lastEmailReceivedAt} >= ${thirtyDaysAgo})`,
            recentlyUnsubscribed: sql<number>`count(*) filter (where ${subscriptions.userUnsubscribedAt} >= ${thirtyDaysAgo})`,
          })
          .from(subscriptions)
          .where(and(...conditions));

        return {
          overall: overallStats,
          byCategory: categoryStats,
          recentActivity,
        };
      } finally {
        await conn.end();
      }
    }),

  bulkUnsubscribe: publicProcedure
    .input(
      z.object({
        subscriptionIds: z.array(z.string()),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { db, conn } = createDb(ctx.env.HYPERDRIVE.connectionString);

      try {
        await db
          .update(subscriptions)
          .set({
            isActive: false,
            userUnsubscribedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(subscriptions.userId, input.userId),
              sql`${subscriptions.id} = ANY(${input.subscriptionIds})`,
            ),
          );

        return { success: true, count: input.subscriptionIds.length };
      } finally {
        await conn.end();
      }
    }),
});
