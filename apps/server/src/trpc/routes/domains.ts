import { domain, domainAccount } from '../../db/schema';
import { SESMailManager } from '../../lib/driver/ses';
import { getZeroDB } from '../../lib/server-utils';
import { router, privateProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const domainSchema = z.object({
  id: z.string(),
  domain: z.string(),
  verified: z.boolean(),
  verificationToken: z.string().nullable(),
  sesIdentityArn: z.string().nullable(),
  dkimTokens: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const domainAccountSchema = z.object({
  id: z.string(),
  domainId: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const domainsRouter = router({
  list: privateProcedure.output(z.array(domainSchema)).query(async ({ ctx }) => {
    const { sessionUser } = ctx;
    if (!sessionUser) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const db = await getZeroDB(sessionUser.id);
    const domains = await db.findUserDomains(sessionUser.id);

    return domains;
  }),

  add: privateProcedure
    .input(z.object({ domain: z.string().min(1) }))
    .output(
      z.object({
        id: z.string(),
        verificationToken: z.string(),
        dkimTokens: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { sessionUser, c } = ctx;
      if (!sessionUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const db = c.get('db') as any;

      const existingDomain = await db
        .select()
        .from(domain)
        .where(eq(domain.domain, input.domain))
        .limit(1);

      if (existingDomain.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Domain already exists',
        });
      }

      const sesManager = new SESMailManager({
        auth: {
          userId: sessionUser.id,
          accessToken: '',
          refreshToken: '',
          email: `admin@${input.domain}`,
        },
      });

      try {
        const { verificationToken } = await sesManager.verifyDomain(input.domain);
        await sesManager.enableDkim(input.domain);

        const domainId = crypto.randomUUID();

        await db.insert(domain).values({
          id: domainId,
          userId: sessionUser.id,
          domain: input.domain,
          verified: false,
          verificationToken,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const { dkimTokens } = await sesManager.getDomainVerificationStatus(input.domain);

        if (dkimTokens) {
          await db
            .update(domain)
            .set({
              dkimTokens,
              updatedAt: new Date(),
            })
            .where(eq(domain.id, domainId));
        }

        return {
          id: domainId,
          verificationToken,
          dkimTokens,
        };
      } catch (error) {
        console.error('Failed to add domain:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add domain to SES',
        });
      }
    }),

  verify: privateProcedure
    .input(z.object({ domainId: z.string() }))
    .output(z.object({ verified: z.boolean(), dkimTokens: z.array(z.string()).optional() }))
    .mutation(async ({ input, ctx }) => {
      const { sessionUser, c } = ctx;
      if (!sessionUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const db = c.get('db') as any;

      const domainRecord = await db
        .select()
        .from(domain)
        .where(and(eq(domain.id, input.domainId), eq(domain.userId, sessionUser.id)))
        .limit(1);

      if (domainRecord.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Domain not found',
        });
      }

      const sesManager = new SESMailManager({
        auth: {
          userId: sessionUser.id,
          accessToken: '',
          refreshToken: '',
          email: `admin@${domainRecord[0].domain}`,
        },
      });

      try {
        const { verified, dkimTokens } = await sesManager.getDomainVerificationStatus(
          domainRecord[0].domain,
        );

        await db
          .update(domain)
          .set({
            verified,
            dkimTokens,
            updatedAt: new Date(),
          })
          .where(eq(domain.id, input.domainId));

        return { verified, dkimTokens };
      } catch (error) {
        console.error('Failed to verify domain:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to verify domain status',
        });
      }
    }),

  delete: privateProcedure
    .input(z.object({ domainId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { sessionUser, c } = ctx;
      if (!sessionUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const db = c.get('db') as any;

      await db
        .delete(domain)
        .where(and(eq(domain.id, input.domainId), eq(domain.userId, sessionUser.id)));

      return { success: true };
    }),

  listAccounts: privateProcedure
    .input(z.object({ domainId: z.string() }))
    .output(z.array(domainAccountSchema))
    .query(async ({ input, ctx }) => {
      const { sessionUser, c } = ctx;
      if (!sessionUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const db = c.get('db') as any;

      const domainRecord = await db
        .select()
        .from(domain)
        .where(and(eq(domain.id, input.domainId), eq(domain.userId, sessionUser.id)))
        .limit(1);

      if (domainRecord.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Domain not found',
        });
      }

      const accounts = await db
        .select()
        .from(domainAccount)
        .where(eq(domainAccount.domainId, input.domainId));

      return accounts;
    }),

  addAccount: privateProcedure
    .input(
      z.object({
        domainId: z.string(),
        email: z.string().email(),
        name: z.string().optional(),
      }),
    )
    .output(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { sessionUser, c } = ctx;
      if (!sessionUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const db = c.get('db') as any;

      const domainRecord = await db
        .select()
        .from(domain)
        .where(and(eq(domain.id, input.domainId), eq(domain.userId, sessionUser.id)))
        .limit(1);

      if (domainRecord.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Domain not found',
        });
      }

      const existingAccount = await db
        .select()
        .from(domainAccount)
        .where(
          and(eq(domainAccount.domainId, input.domainId), eq(domainAccount.email, input.email)),
        )
        .limit(1);

      if (existingAccount.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email account already exists for this domain',
        });
      }

      const accountId = crypto.randomUUID();

      await db.insert(domainAccount).values({
        id: accountId,
        domainId: input.domainId,
        email: input.email,
        name: input.name || null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { id: accountId };
    }),

  deleteAccount: privateProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { sessionUser, c } = ctx;
      if (!sessionUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const db = c.get('db') as any;

      const account = await db
        .select({ domainId: domainAccount.domainId })
        .from(domainAccount)
        .where(eq(domainAccount.id, input.accountId))
        .limit(1);

      if (account.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found',
        });
      }

      const domainRecord = await db
        .select()
        .from(domain)
        .where(and(eq(domain.id, account[0].domainId), eq(domain.userId, sessionUser.id)))
        .limit(1);

      if (domainRecord.length === 0) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authorized to delete this account',
        });
      }

      await db.delete(domainAccount).where(eq(domainAccount.id, input.accountId));

      return { success: true };
    }),
});
