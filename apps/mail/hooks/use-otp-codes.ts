import type { ParsedMessage } from '../../server/src/lib/driver/types';
import { useState, useCallback, useMemo } from 'react';
import { useThreads } from './use-threads';
import { useParams } from 'react-router';

export interface OTPCode {
  id: string;
  code: string;
  service: string;
  threadId: string;
  from: string;
  subject: string;
  receivedAt: Date;
  expiresAt?: Date;
  isExpired: boolean;
}

// Common OTP patterns
const OTP_PATTERNS = [
  // 6-8 digit codes
  /\b(\d{6,8})\b/,
  // Codes with dashes or spaces
  /\b(\d{3}[-\s]?\d{3})\b/,
  // Alphanumeric codes
  /\b([A-Z0-9]{6,8})\b/,
  // With prefix text
  /(?:code|verification|otp|pin)[\s:]+([A-Z0-9]{4,8})/i,
  /(?:is|:)\s*([A-Z0-9]{4,8})\b/i,
];

// Service detection patterns
const SERVICE_PATTERNS: Record<string, RegExp[]> = {
  Google: [/google/i, /gmail/i, /youtube/i],
  Microsoft: [/microsoft/i, /outlook/i, /office/i, /azure/i],
  Amazon: [/amazon/i, /aws/i],
  Apple: [/apple/i, /icloud/i],
  Facebook: [/facebook/i, /meta/i],
  Twitter: [/twitter/i, /x\.com/i],
  GitHub: [/github/i],
  LinkedIn: [/linkedin/i],
  PayPal: [/paypal/i],
  Stripe: [/stripe/i],
  Discord: [/discord/i],
  Slack: [/slack/i],
  Notion: [/notion/i],
  Vercel: [/vercel/i],
  Cloudflare: [/cloudflare/i],
};

const detectOTPFromEmail = (message: ParsedMessage): OTPCode | null => {
  if (!message.subject && !message.body) return null;

  // Check if this is likely an OTP email
  const otpKeywords = [
    'verification code',
    'verify',
    'otp',
    'one-time',
    'authentication',
    '2fa',
    'two-factor',
    'security code',
    'confirmation code',
    'access code',
    'login code',
  ];

  const content = `${message.subject} ${message.body}`.toLowerCase();
  const hasOTPKeyword = otpKeywords.some((keyword) => content.includes(keyword));

  if (!hasOTPKeyword) return null;

  // Extract the code
  let code: string | null = null;
  const bodyText = message.body || '';

  for (const pattern of OTP_PATTERNS) {
    const match = bodyText.match(pattern);
    if (match && match[1]) {
      code = match[1].replace(/[-\s]/g, '');
      break;
    }
  }

  if (!code) return null;

  // Detect service
  let service = 'Unknown Service';
  const fromEmail = message.from?.email || '';
  const fromName = message.from?.name || '';

  for (const [serviceName, patterns] of Object.entries(SERVICE_PATTERNS)) {
    if (
      patterns.some(
        (pattern) =>
          pattern.test(fromEmail) || pattern.test(fromName) || pattern.test(message.subject || ''),
      )
    ) {
      service = serviceName;
      break;
    }
  }

  // If no known service, try to extract from sender
  if (service === 'Unknown Service' && message.from?.name) {
    service = message.from.name.split(' ')[0];
  }

  const receivedAt = new Date(message.date);
  const expiresAt = new Date(receivedAt.getTime() + 10 * 60 * 1000); // 10 minutes
  const isExpired = new Date() > expiresAt;

  return {
    id: `${message.id}-otp`,
    code,
    service,
    threadId: message.threadId || message.id,
    from: fromEmail,
    subject: message.subject || '',
    receivedAt,
    expiresAt,
    isExpired,
  };
};

export const useOTPCodes = () => {
  const { folder } = useParams<{ folder: string }>();
  const [showExpired, setShowExpired] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Get recent emails from inbox
  const [threadsQuery, threads] = useThreads();

  // Extract OTP codes from emails
  const otpCodes = useMemo(() => {
    if (!threads || folder !== 'inbox') return [];

    const codes: OTPCode[] = [];
    const seenCodes = new Set<string>();

    // Only check emails from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const thread of threads) {
      if (!thread.latest) continue;

      const messageDate = new Date(thread.latest.date);
      if (messageDate < oneDayAgo) continue;

      const otp = detectOTPFromEmail(thread.latest);
      if (otp && !seenCodes.has(otp.code)) {
        seenCodes.add(otp.code);
        codes.push(otp);
      }
    }

    // Sort by date, newest first
    codes.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

    return showExpired ? codes : codes.filter((code) => !code.isExpired);
  }, [threads, folder, showExpired]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (code: OTPCode) => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopiedId(code.id);
      setTimeout(() => setCopiedId(null), 2000);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, []);

  // Mark as used (dismiss)
  const [dismissedCodes, setDismissedCodes] = useState<Set<string>>(new Set());

  const dismissCode = useCallback((codeId: string) => {
    setDismissedCodes((prev) => new Set(prev).add(codeId));
  }, []);

  const visibleCodes = useMemo(() => {
    return otpCodes.filter((code) => !dismissedCodes.has(code.id));
  }, [otpCodes, dismissedCodes]);

  return {
    codes: visibleCodes,
    isLoading: threadsQuery.isLoading,
    showExpired,
    setShowExpired,
    copyToClipboard,
    dismissCode,
    copiedId,
    hasExpiredCodes: otpCodes.some((code) => code.isExpired),
  };
};
