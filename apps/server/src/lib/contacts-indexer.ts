import { getZeroAgent } from './server-utils';
import { upsertContacts } from './contacts-cache';
import type { IGetThreadResponse } from './driver/types';
import type { ParsedMessage, Sender } from '../types';

const normalise = (email: string) => email.trim().toLowerCase();

type ThreadSummary = { id: string; historyId: string | null; $raw?: unknown };

export async function buildContactsIndex(connectionId: string) {
  console.log(`[ContactsIndexer] Starting full index for ${connectionId}`);
  const agent = await getZeroAgent(connectionId);

  let userEmails: Set<string> = new Set();
  try {
    const aliases = await agent.getEmailAliases();
    userEmails = new Set(aliases.map((a: { email: string }) => normalise(a.email)));
  } catch {}
  const emailsMap = new Map<string, { email: string; name?: string | null; freq: number }>();
  
  const addEmail = (email: string, name?: string | null, weight = 1) => {
    const key = email.toLowerCase();
    const existing = emailsMap.get(key);
    emailsMap.set(key, {
      email,
      name: name || existing?.name || null,
      freq: (existing?.freq || 0) + weight,
    });
  };

  let totalProcessed = 0;
  
  const foldersToProcess = ['inbox', 'sent', 'draft', 'trash'];

  for (const folder of foldersToProcess) {
    try {
      console.log(`[ContactsIndexer] Processing ${folder}...`);
      let cursor = '';
      let pageCount = 0;
      
      do {
        const batch = (await agent.listThreads({
          folder,
          query: '',
          maxResults: 100,
          pageToken: cursor,
        })) as { threads: ThreadSummary[]; nextPageToken: string | null };
        
        const threads: ThreadSummary[] = batch.threads || [];
        if (!threads.length) break;
        
        const processThread = async (thread: ThreadSummary) => {
          try {
            const threadData: IGetThreadResponse = await agent.getThread(thread.id);

            if (!threadData || threadData.messages.length === 0) return;

            threadData.messages.forEach((message: ParsedMessage) => {
              if (message.sender?.email && !userEmails.has(normalise(message.sender.email))) {
                addEmail(message.sender.email, message.sender.name, 1);
              }

              const weightBase = 2;
              const toList = message.to || [];
              const ccList = message.cc || [];
              const bccList = message.bcc || [];

              const addRecipients = (list: Sender[], weight: number) =>
                list.forEach((r) => {
                  if (!r.email) return;
                  if (userEmails.has(normalise(r.email))) return;
                  addEmail(r.email, r.name, weight);
                });

              const userIsSender = message.sender?.email && userEmails.has(normalise(message.sender.email));

              addRecipients(toList, userIsSender ? weightBase + 1 : weightBase);
              addRecipients(ccList, userIsSender ? weightBase : weightBase - 1);
              addRecipients(bccList, userIsSender ? weightBase : weightBase - 1);
            });
          } catch {}
        };

        const concurrency = 5;
        for (let i = 0; i < threads.length; i += concurrency) {
          const slice = threads.slice(i, i + concurrency);
          await Promise.allSettled(slice.map(processThread));
        }
        
        totalProcessed += threads.length;
        pageCount++;
        cursor = batch.nextPageToken || '';
        
        if (totalProcessed % 500 === 0) {
          console.log(`[ContactsIndexer] Processed ${totalProcessed} threads, saving checkpoint...`);
          await upsertContacts(connectionId, Array.from(emailsMap.values()));
        }
      } while (cursor);
      
    } catch (error) {
      console.warn(`[ContactsIndexer] Failed to process ${folder}:`, error);
    }
  }
  
  const contacts = Array.from(emailsMap.values());
  await upsertContacts(connectionId, contacts);
  
  console.log(`[ContactsIndexer] Complete! Indexed ${contacts.length} unique contacts from ${totalProcessed} threads`);
  return contacts.length;
}

export async function scheduleContactsIndexing(connectionId: string) {
  return buildContactsIndex(connectionId).catch(e => 
    console.error(`[ContactsIndexer] Background indexing failed for ${connectionId}:`, e)
  );
}