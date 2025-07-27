import type { Context } from 'aws-lambda';

interface SESMail {
  timestamp: string;
  source: string;
  messageId: string;
  destination: string[];
  headersTruncated: boolean;
  headers: Array<{
    name: string;
    value: string;
  }>;
  commonHeaders: {
    from: string[];
    to: string[];
    messageId: string;
    subject: string;
  };
}

interface SESReceipt {
  timestamp: string;
  processingTimeMillis: number;
  recipients: string[];
  spamVerdict: {
    status: string;
  };
  virusVerdict: {
    status: string;
  };
  spfVerdict: {
    status: string;
  };
  dkimVerdict: {
    status: string;
  };
  dmarcVerdict: {
    status: string;
  };
  action: {
    type: string;
    functionArn: string;
    invocationType: string;
  };
}

interface SESRecord {
  eventSource: string;
  eventVersion: string;
  ses: {
    mail: SESMail;
    receipt: SESReceipt;
  };
}

interface SESEvent {
  Records: SESRecord[];
}

interface CloudflareWorkerPayload {
  eventSource: string;
  eventVersion: string;
  ses: {
    mail: SESMail;
    receipt: SESReceipt;
  };
  timestamp: string;
}

export const handler = async (event: SESEvent, context: Context) => {
  console.log('Received SES event:', JSON.stringify(event, null, 2));
  
  for (const record of event.Records) {
    await processSESRecord(record);
  }
  
  return { statusCode: 200, body: 'Email processed successfully' };
};

async function processSESRecord(record: SESRecord) {
  const { mail, receipt } = record.ses;
  
  const recipientDomain = mail.destination[0]?.split('@')[1];
  
  if (!recipientDomain) {
    console.log('No recipient domain found, skipping');
    return;
  }
  
  const payload: CloudflareWorkerPayload = {
    eventSource: record.eventSource,
    eventVersion: record.eventVersion,
    ses: { mail, receipt },
    timestamp: new Date().toISOString()
  };
  
  await forwardToCloudflareWorkers(payload);
}

async function forwardToCloudflareWorkers(payload: CloudflareWorkerPayload) {
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
  const authToken = process.env.CLOUDFLARE_AUTH_TOKEN;
  
  if (!workerUrl) {
    console.error('CLOUDFLARE_WORKER_URL not configured');
    return;
  }
  
  try {
    const response = await fetch(`${workerUrl}/webhook/ses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        Type: 'Notification',
        Message: JSON.stringify(payload)
      })
    });
    
    if (!response.ok) {
      console.error('Failed to forward to Cloudflare Workers:', response.status);
    } else {
      console.log('Successfully forwarded to Cloudflare Workers');
    }
  } catch (error) {
    console.error('Error forwarding to Cloudflare Workers:', error);
  }
}
