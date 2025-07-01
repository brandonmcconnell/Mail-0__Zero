import { getZeroDB } from './server-utils';
import { randomUUID } from 'node:crypto';

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
    if (payload.name.length > 100) {
      throw new Error('Template name must be at most 100 characters');
    }
    
    if (payload.subject && payload.subject.length > 500) {
      throw new Error('Template subject must be at most 500 characters');
    }
    
    if (payload.body && payload.body.length > 50000) {
      throw new Error('Template body must be at most 50,000 characters');
    }

    const db = getZeroDB(userId);
    
    const existingTemplates = (await db.listEmailTemplates()) as EmailTemplate[];
    const nameExists = existingTemplates.some((template: EmailTemplate) => 
      template.name.toLowerCase() === payload.name.toLowerCase()
    );
    
    if (nameExists) {
      throw new Error(`A template named "${payload.name}" already exists. Please choose a different name.`);
    }
    
    const id = payload.id ?? randomUUID();
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