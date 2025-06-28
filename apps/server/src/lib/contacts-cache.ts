import { env } from 'cloudflare:workers';

export interface ContactEntry {
  email: string;
  name?: string | null;
  freq: number;
  last: number;
}

const KV = (env).CONTACTS_KV as KVNamespace;

const keyForUser = (userId: string) => `contacts:${userId}`;

export async function getContacts(userId: string): Promise<ContactEntry[]> {
  const data = await KV.get<ContactEntry[]>(keyForUser(userId), 'json');
  return data ?? [];
}

export async function upsertContacts(userId: string, contacts: { email: string; name?: string | null }[]) {
  if (!contacts.length) return;

  const existing = await getContacts(userId);
  const map = new Map<string, ContactEntry>();
  existing.forEach((c) => map.set(c.email.toLowerCase(), c));

  const now = Date.now();
  for (const c of contacts) {
    const key = c.email.toLowerCase();
    const prev = map.get(key);
    map.set(key, {
      email: c.email,
      name: c.name ?? prev?.name ?? null,
      freq: (prev?.freq ?? 0) + 1,
      last: now,
    });
  }

  await KV.put(keyForUser(userId), JSON.stringify(Array.from(map.values())));
}

export async function suggestContacts(userId: string, query: string, limit = 10) {
  const contacts = await getContacts(userId);
  const lower = query.toLowerCase();
  const filtered = lower
    ? contacts.filter(
        (c) =>
          c.email.toLowerCase().startsWith(lower) || c.name?.toLowerCase().startsWith(lower),
      )
    : contacts;
  filtered.sort((a, b) => b.freq - a.freq || b.last - a.last);
  return filtered.slice(0, limit).map(({ email, name }) => ({ email, name, displayText: name ? `${name} <${email}>` : email }));
}