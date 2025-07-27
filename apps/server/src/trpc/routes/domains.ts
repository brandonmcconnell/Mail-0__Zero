import { SESMailManager } from '../../lib/driver/ses';
import { getZeroDB } from '../../lib/server-utils';
import { router, privateProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
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
    const domains = await db.findManyDomains();

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
      const { sessionUser } = ctx;
      if (!sessionUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const db = await getZeroDB(sessionUser.id);
      
      const existingDomain = await db.findDomainByName(input.domain);

      if (existingDomain) {
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
        
        const result = await db.createDomain({
          id: domainId,
          domain: input.domain,
          verified: false,
          verificationToken,
        });

        const { dkimTokens } = await sesManager.getDomainVerificationStatus(input.domain);

        if (dkimTokens && result.length > 0) {
          await db.updateDomain(domainId, { 
            dkimTokens,
          });
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
      const { sessionUser } = ctx;
      if (!sessionUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const db = await getZeroDB(sessionUser.id);
      
      const domainRecord = await db.findDomainById(input.domainId);

      if (!domainRecord) {
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
          email: `admin@${domainRecord.domain}`,
        },
      });

      try {
        const { verified, dkimTokens } = await sesManager.getDomainVerificationStatus(domainRecord.domain);

        await db.updateDomain(input.domainId, { 
          verified,
          dkimTokens,
        });

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
      const { sessionUser } = ctx;
      if (!sessionUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const db = await getZeroDB(sessionUser.id);
      
      await db.deleteDomain(input.domainId);

      return { success: true };
    }),

  listAccounts: privateProcedure
    .input(z.object({ domainId: z.string() }))
    .output(z.array(domainAccountSchema))
    .query(async ({ input, ctx }) => {
      const { sessionUser } = ctx;
      if (!sessionUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const db = await getZeroDB(sessionUser.id);
      
      const domainRecord = await db.findDomainById(input.domainId);

      if (!domainRecord) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Domain not found',
        });
      }

      const accounts = await db.findManyDomainAccounts(input.domainId);

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
      const { sessionUser } = ctx;
      if (!sessionUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const db = await getZeroDB(sessionUser.id);
      
      const domainRecord = await db.findDomainById(input.domainId);

      if (!domainRecord) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Domain not found',
        });
      }

      const accounts = await db.findManyDomainAccounts(input.domainId);
      const existingAccount = accounts.find((account: any) => account.email === input.email);

      if (existingAccount) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email account already exists for this domain',
        });
      }

      const accountId = crypto.randomUUID();
      
      await db.createDomainAccount({
        id: accountId,
        domainId: input.domainId,
        email: input.email,
        name: input.name || null,
        active: true,
      });

      return { id: accountId };
    }),

  deleteAccount: privateProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { sessionUser } = ctx;
      if (!sessionUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const db = await getZeroDB(sessionUser.id);
      
      const account = await db.findDomainAccountById(input.accountId);

      if (!account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found',
        });
      }

      const domainRecord = await db.findDomainById(account.domainId);

      if (!domainRecord) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authorized to delete this account',
        });
      }

      await db.deleteDomainAccount(input.accountId);

      return { success: true };
    }),
});
