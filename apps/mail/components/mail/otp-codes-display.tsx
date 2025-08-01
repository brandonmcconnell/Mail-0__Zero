import { useOTPCodes, type OTPCode } from '@/hooks/use-otp-codes';
import { Copy, X, Clock, AlertCircle } from 'lucide-react';
import { BimiAvatar } from '@/components/ui/bimi-avatar';
import { Button } from '@/components/ui/button';
import { cn, formatTimeAgo } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { memo } from 'react';

export const OTPCodesDisplay = memo(function OTPCodesDisplay() {
  const {
    // codes,
    // isLoading,
    showExpired,
    setShowExpired,
    copyToClipboard,
    dismissCode,
    copiedId,
    hasExpiredCodes,
  } = useOTPCodes();

  // if (isLoading || codes.length === 0) return null;

  const codes = [
    {
      id: '1',
      code: '123456',
      service: 'Service 1',
      subject: 'Subject 1',
      receivedAt: new Date(),
      threadId: '1',
      from: 'test@test.com',
      isExpired: false,
    },
    {
      id: '2',
      code: '123456',
      service: 'Service 2',
      subject: 'Subject 2',
      receivedAt: new Date(),
      threadId: '2',
      from: 'test2@test.com',
      isExpired: false,
    },
  ];

  return (
    <div className="mb-4 h-40 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="ml-2 mt-2 text-sm font-medium">Recent Verification Codes</h3>
        {hasExpiredCodes && !showExpired && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExpired(true)}
            className="text-xs"
          >
            Show expired
          </Button>
        )}
      </div>

      <div className="grid gap-1">
        {codes.map((code: OTPCode) => (
          <CodeCard
            key={code.id}
            code={code}
            copyToClipboard={copyToClipboard}
            dismissCode={dismissCode}
            copiedId={copiedId}
          />
        ))}
      </div>
    </div>
  );
});

const CodeCard = memo(function CodeCard({
  code,
  copyToClipboard,
  dismissCode,
  copiedId,
}: {
  code: OTPCode;
  copyToClipboard: (code: OTPCode) => void;
  dismissCode: (codeId: string) => void;
  copiedId: string | null;
}) {
  return (
    <div className={cn('select-none border-b md:my-1 md:border-none')}>
      <div
        data-thread-id={code.id}
        key={code.id}
        className={cn(
          'hover:bg-offsetLight hover:bg-primary/5 relative mx-1 flex flex-col items-start rounded-lg py-2 text-left text-sm transition-all hover:opacity-100',
          code.isExpired && 'opacity-60',
        )}
      >
        <div className={`relative flex w-full items-center justify-between gap-4 px-4 pr-1`}>
          <div>
            <BimiAvatar
              email={code.from}
              name={code.service}
              className={cn('h-8 w-8 rounded-full')}
            />
          </div>

          <div className="flex w-full items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{code.service}</span>
                <Badge
                  variant="secondary"
                  className="bg-black/10 font-mono text-xs dark:bg-white/10"
                >
                  {code.code}
                </Badge>
                {code.isExpired && (
                  <Badge variant="destructive" className="text-xs">
                    Expired
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                <Clock className="h-3 w-3" />
                <span>{formatTimeAgo(code.receivedAt)}</span>
                <span className="truncate">{code.subject}</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(code);
                }}
                disabled={code.isExpired}
                className="text-muted-foreground h-8 w-8 p-0"
              >
                {copiedId === code.id ? (
                  <AlertCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissCode(code.id);
                }}
                className="text-muted-foreground h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
