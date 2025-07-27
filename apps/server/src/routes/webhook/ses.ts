import { Hono } from 'hono';
import { domain, domainAccount } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { createDb } from '../../db';

const app = new Hono();

app.post('/webhook/ses', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const expectedToken = env.SES_LAMBDA_AUTH_TOKEN;
    
    if (expectedToken && (!authHeader || authHeader !== `Bearer ${expectedToken}`)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const body = await c.req.json();
    
    if (body.Type === 'SubscriptionConfirmation') {
      return c.json({ message: 'Subscription confirmed' });
    }
    
    if (body.Type === 'Notification') {
      const message = JSON.parse(body.Message);
      
      if (message.eventType === 'send' || message.eventType === 'receive') {
        const db = createDb(env.HYPERDRIVE.connectionString).db;
        const recipientDomain = message.mail.destination[0].split('@')[1];
        
        const domainRecord = await db.query.domain.findFirst({
          where: and(eq(domain.domain, recipientDomain), eq(domain.verified, true)),
        });
          
        if (domainRecord) {
          const accounts = await db.query.domainAccount.findMany({
            where: and(
              eq(domainAccount.domainId, domainRecord.id),
              eq(domainAccount.active, true)
            ),
          });
            
          for (const account of accounts) {
            if (message.mail.destination.includes(account.email)) {
              console.log(`Processing email for ${account.email}`);
            }
          }
        }
      }
    }
    
    return c.json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('SES webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

export default app;
