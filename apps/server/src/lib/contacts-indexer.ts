import { getZeroAgent } from './server-utils';
import { upsertContacts } from './contacts-cache';
import type { IGetThreadResponse } from './driver/types';
import type { ParsedMessage, Sender } from '../types';

type ThreadSummary = { id: string; historyId: string | null; $raw?: unknown };

export async function buildContactsIndex(connectionId: string) {
  console.log(`[ContactsIndexer] Starting full index for ${connectionId}`);
  const agent = await getZeroAgent(connectionId);
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
        const batch = (await agent.list({
          folder,
          query: '',
          maxResults: 100,
          pageToken: cursor,
        })) as { threads: ThreadSummary[]; nextPageToken: string | null };
        
        const threads: ThreadSummary[] = batch.threads || [];
        if (!threads.length) break;
        
        await Promise.allSettled(
          threads.map(async (thread: ThreadSummary) => {
            try {
              const threadData: IGetThreadResponse = await agent.get(thread.id);
              threadData.messages.forEach((message: ParsedMessage) => {
                if (folder === 'sent') {
                  (message.to || []).forEach((r: Sender) => addEmail(r.email, r.name, 3));
                  (message.cc || []).forEach((r: Sender) => addEmail(r.email, r.name, 2));
                  (message.bcc || []).forEach((r: Sender) => addEmail(r.email, r.name, 2));
                }
                if (message.sender?.email) {
                  addEmail(message.sender.email, message.sender.name, 1);
                }
              });
            } catch (e) {
            }
          })
        );
        
        totalProcessed += threads.length;
        pageCount++;
        cursor = batch.nextPageToken || '';
        
        if (totalProcessed % 500 === 0) {
          console.log(`[ContactsIndexer] Processed ${totalProcessed} threads, saving checkpoint...`);
          await upsertContacts(connectionId, Array.from(emailsMap.values()));
        }
        
        if (pageCount > 50) break;
        
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