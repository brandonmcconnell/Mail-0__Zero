// Mock for cloudflare:workers module
export const env = {
  DB: {},
  snoozed_emails: {
    delete: () => Promise.resolve(),
  },
};