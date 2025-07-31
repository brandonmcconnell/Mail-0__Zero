import type { IGetThreadResponse } from '../lib/driver/types';
import { composeEmail } from '../trpc/routes/ai/compose';
import { type ParsedMessage } from '../types';
import { connection } from '../db/schema';

const shouldGenerateDraft = async (
  thread: IGetThreadResponse,
  foundConnection: typeof connection.$inferSelect,
): Promise<boolean> => {
  if (!thread.messages || thread.messages.length === 0) {
    console.log('[SHOULD_GENERATE_DRAFT] No messages in thread');
    return false;
  }

  const latestMessage = thread.messages[thread.messages.length - 1];

  if (latestMessage.sender?.email?.toLowerCase() === foundConnection.email?.toLowerCase()) {
    console.log('[SHOULD_GENERATE_DRAFT] Latest message is from user, skipping draft');
    return false;
  }

  const senderEmail = latestMessage.sender?.email?.toLowerCase() || '';
  const subject = latestMessage.subject?.toLowerCase() || '';
  const decodedBody = latestMessage.decodedBody?.toLowerCase() || '';

  const automatedEmailRegex = /(no-?reply|donotreply|do-not-reply)/;
  const automatedSubjectRegex = /(newsletter|unsubscribe|notification)/;
  const automatedBodyRegex = /(do not reply|this is an automated)/;

  if (
    automatedEmailRegex.test(senderEmail) ||
    automatedSubjectRegex.test(subject) ||
    automatedBodyRegex.test(decodedBody)
  ) {
    console.log(
      '[SHOULD_GENERATE_DRAFT] Message is likely automated or not actionable, skipping draft',
    );
    return false;
  }

  if (latestMessage.receivedOn) {
    const messageDate = new Date(latestMessage.receivedOn);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (messageDate < sevenDaysAgo) {
      console.log('[SHOULD_GENERATE_DRAFT] Latest message is older than 7 days, skipping draft');
      return false;
    }
  }

  try {
    const threadId = thread.messages[0]?.threadId;
    if (!threadId) {
      console.log('[SHOULD_GENERATE_DRAFT] No thread ID found, skipping draft check');
      return true;
    }

    const latestDraft = thread.isLatestDraft;

    if (latestDraft) {
      console.log('[SHOULD_GENERATE_DRAFT] Draft already exists in thread, skipping draft');
      return false;
    }
  } catch (error) {
    console.error('[SHOULD_GENERATE_DRAFT] Error checking for existing drafts:', error);
  }

  console.log('[SHOULD_GENERATE_DRAFT] Draft should be generated for this thread');
  return true;
};

const analyzeEmailIntent = (message: ParsedMessage) => {
  const content = (message.decodedBody || message.body || '').toLowerCase();
  const subject = (message.subject || '').toLowerCase();

  return {
    isQuestion:
      /\?/.test(content) ||
      /\b(what|when|where|how|why|can you|could you|would you)\b/.test(content),
    isRequest: /\b(please|request|need|require|can you|could you|would you mind)\b/.test(content),
    isMeeting: /\b(meeting|schedule|calendar|appointment|call|zoom|teams|meet)\b/.test(
      content + ' ' + subject,
    ),
    isUrgent: /\b(urgent|asap|immediate|priority|rush)\b/.test(content + ' ' + subject),
  };
};

const generateAutomaticDraft = async (
  connectionId: string,
  thread: IGetThreadResponse,
  foundConnection: typeof connection.$inferSelect,
): Promise<string | null> => {
  try {
    const latestMessage = thread.messages[thread.messages.length - 1];

    const emailAnalysis = analyzeEmailIntent(latestMessage);

    let prompt = 'Generate a professional and contextually appropriate reply to this email thread.';

    if (emailAnalysis.isQuestion) {
      prompt =
        'This email contains questions. Generate a helpful response that addresses the questions asked. Be thorough but concise.';
    } else if (emailAnalysis.isRequest) {
      prompt =
        'This email contains a request. Generate a response that acknowledges the request and provides next steps or asks for clarification if needed.';
    } else if (emailAnalysis.isMeeting) {
      prompt =
        'This email is about scheduling or meetings. Generate an appropriate response about availability, meeting coordination, or confirmation.';
    } else if (emailAnalysis.isUrgent) {
      prompt =
        'This email appears urgent. Generate a prompt acknowledgment response that addresses the urgency and provides next steps.';
    }

    const threadMessages = thread.messages.map((message) => ({
      from: message.sender?.name || message.sender?.email || 'Unknown',
      to: message.to?.map((r) => r.name || r.email) || [],
      cc: message.cc?.map((r) => r.name || r.email) || [],
      subject: message.subject || '',
      body: message.decodedBody || message.body || '',
    }));

    const draftContent = await composeEmail({
      prompt,
      threadMessages,
      username: foundConnection.name || foundConnection.email || 'User',
      connectionId,
    });

    return draftContent;
  } catch (error) {
    console.log('[THREAD_WORKFLOW] Failed to generate automatic draft:', {
      connectionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const detectSubscriptionEmail = (message: ParsedMessage): boolean => {
  // Check for List-Unsubscribe header
  if (message.listUnsubscribe) {
    console.log('[DETECT_SUBSCRIPTION] Found List-Unsubscribe header');
    return true;
  }

  const senderEmail = message.sender?.email?.toLowerCase() || '';
  const senderName = message.sender?.name?.toLowerCase() || '';
  const subject = message.subject?.toLowerCase() || '';
  const decodedBody = message.decodedBody?.toLowerCase() || '';

  // Common subscription sender patterns
  const subscriptionSenderPatterns = [
    /newsletter/,
    /no-?reply/,
    /donotreply/,
    /noreply/,
    /notifications?/,
    /updates?/,
    /digest/,
    /bulletin/,
    /announcements?/,
    /marketing/,
    /promotions?/,
    /campaigns?/,
  ];

  // Check sender email/name
  const senderIsSubscription = subscriptionSenderPatterns.some(
    (pattern) => pattern.test(senderEmail) || pattern.test(senderName),
  );

  if (senderIsSubscription) {
    console.log('[DETECT_SUBSCRIPTION] Sender matches subscription pattern');
    return true;
  }

  // Common subscription subject patterns
  const subscriptionSubjectPatterns = [
    /newsletter/,
    /weekly.*digest/,
    /daily.*digest/,
    /monthly.*update/,
    /\[.*\]/, // Often newsletters use [Company Name] format
    /issue\s*#?\d+/i,
    /edition/i,
    /bulletin/i,
  ];

  const subjectIsSubscription = subscriptionSubjectPatterns.some((pattern) =>
    pattern.test(subject),
  );

  if (subjectIsSubscription) {
    console.log('[DETECT_SUBSCRIPTION] Subject matches subscription pattern');
    return true;
  }

  // Common subscription body patterns
  const subscriptionBodyPatterns = [
    /unsubscribe/i,
    /opt-?out/i,
    /email.*preferences/i,
    /manage.*subscription/i,
    /update.*preferences/i,
    /stop.*receiving/i,
    /remove.*from.*list/i,
    /click.*here.*to.*unsubscribe/i,
    /no.*longer.*wish.*receive/i,
    /view.*in.*browser/i,
    /this.*email.*was.*sent.*to/i,
    /you.*are.*receiving.*this.*because/i,
  ];

  const bodyIsSubscription = subscriptionBodyPatterns.some((pattern) => pattern.test(decodedBody));

  if (bodyIsSubscription) {
    console.log('[DETECT_SUBSCRIPTION] Body contains subscription patterns');
    return true;
  }

  return false;
};

const categorizeSubscription = (
  message: ParsedMessage,
): {
  category: 'newsletter' | 'promotional' | 'social' | 'development' | 'transactional' | 'general';
  confidence: number;
} => {
  const content = (message.decodedBody || message.body || '').toLowerCase();
  const subject = (message.subject || '').toLowerCase();
  const sender = (message.sender?.email || '').toLowerCase();
  const combinedText = sender + ' ' + subject + ' ' + content;

  if (/github|gitlab|bitbucket|jira|confluence|stack\s?overflow/.test(combinedText)) {
    return { category: 'development', confidence: 0.9 };
  }

  if (/sale|discount|offer|deal|coupon|promo|% off|\$\d+/.test(combinedText)) {
    return { category: 'promotional', confidence: 0.85 };
  }

  if (/news|daily|weekly|digest|bulletin|roundup/.test(combinedText)) {
    return { category: 'newsletter', confidence: 0.8 };
  }

  if (/transaction|receipt|order|invoice|payment|purchase|confirm/.test(combinedText)) {
    return { category: 'transactional', confidence: 0.9 };
  }

  if (/facebook|twitter|linkedin|instagram|youtube|tiktok/.test(combinedText)) {
    return { category: 'social', confidence: 0.85 };
  }

  return { category: 'general', confidence: 0.5 };
};

export {
  analyzeEmailIntent,
  generateAutomaticDraft,
  shouldGenerateDraft,
  detectSubscriptionEmail,
  categorizeSubscription,
};
