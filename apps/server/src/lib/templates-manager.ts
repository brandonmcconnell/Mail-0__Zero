import { getZeroDB } from './server-utils';

type EmailTemplate = {
  id: string;
  userId: string;
  name: string;
  subject: string | null;
  body: string | null;
  to: string[] | null;
  cc: string[] | null;
  bcc: string[] | null;
  createdAt: Date;
  updatedAt: Date;
};

export class TemplatesManager {
  async listTemplates(userId: string) {
    const db = getZeroDB(userId);
    return await db.listEmailTemplates();
  }

  async createTemplate(
    userId: string,
    payload: {
      id?: string;
      name: string;
      subject?: string | null;
      body?: string | null;
      to?: string[] | null;
      cc?: string[] | null;
      bcc?: string[] | null;
    },
  ) {
    const db = getZeroDB(userId);
    const id = payload.id ?? crypto.randomUUID();
    const [template] = await db.createEmailTemplate({
      id,
      name: payload.name,
      subject: payload.subject ?? null,
      body: payload.body ?? null,
      to: payload.to ?? null,
      cc: payload.cc ?? null,
      bcc: payload.bcc ?? null,
    }) as EmailTemplate[];
    return template;
  }

  async deleteTemplate(userId: string, templateId: string) {
    const db = getZeroDB(userId);
    await db.deleteEmailTemplate(templateId);
    return true;
  }
} 