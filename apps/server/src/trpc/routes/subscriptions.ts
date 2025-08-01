import { getZeroAgent } from '../../lib/server-utils';
import { router, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export const subscriptionsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        connectionId: z.string(),
        category: z
          .enum(['newsletter', 'promotional', 'social', 'development', 'transactional', 'general'])
          .optional(),
        isActive: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.sessionUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to view subscriptions',
        });
      }

      const agent = await getZeroAgent(input.connectionId);

      return await agent.listSubscriptions({
        userId: ctx.sessionUser.id,
        connectionId: input.connectionId,
        category: input.category,
        isActive: input.isActive,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  get: publicProcedure
    .input(
      z.object({
        subscriptionId: z.string(),
        connectionId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.sessionUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to view subscription details',
        });
      }

      const agent = await getZeroAgent(input.connectionId);

      try {
        return await agent.getSubscription(input.subscriptionId, ctx.sessionUser.id);
      } catch (_error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subscription not found',
        });
      }
    }),

  unsubscribe: publicProcedure
    .input(
      z.object({
        subscriptionId: z.string(),
        connectionId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.sessionUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to unsubscribe',
        });
      }

      const agent = await getZeroAgent(input.connectionId);

      try {
        return await agent.unsubscribeFromEmail(input.subscriptionId, ctx.sessionUser.id);
      } catch (_error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subscription not found',
        });
      }
    }),

  updatePreferences: publicProcedure
    .input(
      z.object({
        subscriptionId: z.string(),
        connectionId: z.string(),
        autoArchive: z.boolean().optional(),
        category: z
          .enum(['newsletter', 'promotional', 'social', 'development', 'transactional', 'general'])
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.sessionUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to update preferences',
        });
      }

      const agent = await getZeroAgent(input.connectionId);

      return await agent.updateSubscriptionPreferences({
        subscriptionId: input.subscriptionId,
        userId: ctx.sessionUser.id,
        autoArchive: input.autoArchive,
        category: input.category,
      });
    }),

  resubscribe: publicProcedure
    .input(
      z.object({
        subscriptionId: z.string(),
        connectionId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.sessionUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to resubscribe',
        });
      }

      const agent = await getZeroAgent(input.connectionId);

      return await agent.resubscribeToEmail(input.subscriptionId, ctx.sessionUser.id);
    }),

  stats: publicProcedure
    .input(
      z.object({
        connectionId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.sessionUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to view statistics',
        });
      }

      if (!input.connectionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Connection ID is required',
        });
      }

      const agent = await getZeroAgent(input.connectionId);

      return await agent.getSubscriptionStats(ctx.sessionUser.id, input.connectionId);
    }),

  bulkUnsubscribe: publicProcedure
    .input(
      z.object({
        subscriptionIds: z.array(z.string()),
        connectionId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.sessionUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to bulk unsubscribe',
        });
      }

      const agent = await getZeroAgent(input.connectionId);

      return await agent.bulkUnsubscribeEmails(input.subscriptionIds, ctx.sessionUser.id);
    }),
});
