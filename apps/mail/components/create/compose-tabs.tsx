import {
  activeComposeTabIdAtom,
  addComposeTabAtom,
  composeTabsAtom,
  fullscreenTabIdAtom,
  removeComposeTabAtom,
  toggleFullscreenTabAtom,
  toggleMinimizeTabAtom,
  updateComposeTabAtom,
} from '@/store/composeTabsStore';

import { Maximize2, Minimize2, Minus, Plus, X } from 'lucide-react';
import { useActiveConnection } from '@/hooks/use-connections';
import { useEmailAliases } from '@/hooks/use-email-aliases';
import { AnimatePresence, motion } from 'motion/react';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { useSettings } from '@/hooks/use-settings';
import { EmailComposer } from './email-composer';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { serializeFiles } from '@/lib/schemas';
import { useDraft } from '@/hooks/use-drafts';
import { useAtom, useSetAtom } from 'jotai';
import type { Attachment } from '@/types';
import { useMemo } from 'react';
import { toast } from 'sonner';

// Component to handle draft loading for each tab
function ComposeTabContent({
  tab,
  tabId,
  onSendEmail,
  onChange,
  updateTab,
  settingsLoading,
  isFullscreen = false,
}: {
  tab: any; // Using any for now since ComposeTab is from the store
  tabId: string;
  onSendEmail: (tabId: string, data: any) => void;
  onChange: (updates: any) => void;
  updateTab: (updates: { id: string; updates: any }) => void;
  settingsLoading: boolean;
  isFullscreen?: boolean;
}) {
  const { data: draft, isLoading: isDraftLoading } = useDraft(tab.draftId || null);

  if (isDraftLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
          <p>Loading draft...</p>
        </div>
      </div>
    );
  }

  // Use draft data if available, otherwise use tab data
  const initialTo = draft?.to?.map((e: string) => e.replace(/[<>]/g, '')) || tab.to || [];
  const initialCc = draft?.cc?.map((e: string) => e.replace(/[<>]/g, '')) || tab.cc || [];
  const initialBcc = draft?.bcc?.map((e: string) => e.replace(/[<>]/g, '')) || tab.bcc || [];
  const initialSubject = draft?.subject || tab.subject || '';
  const initialMessage = draft?.content || tab.body || '';

  return (
    <EmailComposer
      inATab={true}
      initialTo={initialTo}
      initialCc={initialCc}
      initialBcc={initialBcc}
      initialSubject={initialSubject}
      initialMessage={initialMessage}
      initialAttachments={tab.attachments || []}
      draftId={tab.draftId}
      onSendEmail={async (data) => await onSendEmail(tabId, data)}
      onClose={() => {
        /* Handled by parent */
      }}
      onChange={onChange}
      onDraftCreated={(newDraftId) => {
        // Update the tab with the new draft ID
        updateTab({ id: tabId, updates: { draftId: newDraftId } });
      }}
      className="h-full"
      autofocus={true}
      settingsLoading={settingsLoading}
      isFullscreen={isFullscreen}
    />
  );
}

export function ComposeTabs() {
  const [composeTabs] = useAtom(composeTabsAtom);
  const [activeTabId, setActiveTabId] = useAtom(activeComposeTabIdAtom);
  const [fullscreenTabId] = useAtom(fullscreenTabIdAtom);
  const addTab = useSetAtom(addComposeTabAtom);
  const removeTab = useSetAtom(removeComposeTabAtom);
  const updateTab = useSetAtom(updateComposeTabAtom);
  const toggleMinimize = useSetAtom(toggleMinimizeTabAtom);
  const toggleFullscreen = useSetAtom(toggleFullscreenTabAtom);

  const { data: session } = useSession();
  const { data: activeConnection } = useActiveConnection();
  const { data: aliases } = useEmailAliases();
  const { data: settings, isLoading: settingsLoading } = useSettings();

  const trpc = useTRPC();
  const { mutateAsync: sendEmail } = useMutation(trpc.mail.send.mutationOptions());

  const userEmail = activeConnection?.email || session?.user?.email || '';

  const handleAddTab = () => {
    addTab({});
  };

  const handleSendEmail = async (
    tabId: string,
    data: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      message: string;
      attachments: File[];
      fromEmail?: string;
    },
  ) => {
    const fromEmail = data.fromEmail || aliases?.[0]?.email || userEmail;

    if (!fromEmail) {
      toast.error('No email address available to send from');
      return;
    }

    const zeroSignature = settings?.settings.zeroSignature
      ? '<p style="color: #666; font-size: 12px;">Sent via <a href="https://0.email/" style="color: #0066cc; text-decoration: none;">Zero</a></p>'
      : '';

    try {
      await sendEmail({
        to: data.to.map((email) => ({ email, name: email?.split('@')[0] || email })),
        cc: data.cc?.map((email) => ({ email, name: email?.split('@')[0] || email })),
        bcc: data.bcc?.map((email) => ({ email, name: email?.split('@')[0] || email })),
        subject: data.subject,
        message: data.message + zeroSignature,
        threadId: undefined,
        attachments: data.attachments.length > 0 ? await serializeFiles(data.attachments) : [],
        fromEmail: fromEmail,
      });

      toast.success('Email sent successfully');
      removeTab(tabId);
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email');
    }
  };

  const tabs = Array.from(composeTabs.entries());

  if (tabs.length === 0) {
    return null;
  }

  const isFullscreen = !!fullscreenTabId;
  const fullscreenTab = fullscreenTabId ? composeTabs.get(fullscreenTabId) : null;

  if (isFullscreen && fullscreenTab) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#FAFAFA] dark:bg-[#141414]"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b p-2 pr-1.5">
            <h2 className="text-lg font-semibold">{fullscreenTab.subject || 'New Email'}</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleFullscreen(null)}
                className="h-8 w-8"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeTab(fullscreenTabId)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <ComposeTabContent
              tab={fullscreenTab}
              tabId={fullscreenTabId}
              onSendEmail={handleSendEmail}
              onChange={(updates) => updateTab({ id: fullscreenTabId, updates })}
              updateTab={updateTab}
              settingsLoading={settingsLoading}
              isFullscreen={true}
            />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-32px)] flex-row-reverse items-end gap-3">
        <AnimatePresence>
          {Array.from(composeTabs.values()).map((tab) => {
            const index = Array.from(composeTabs.values()).indexOf(tab);

            return (
              <motion.div
                key={tab.id}
                layout
                layoutId={`compose-tab-${tab.id}`}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  width: tab.isMinimized ? 'auto' : '450px',
                  height: tab.isMinimized ? 'auto' : '600px',
                }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 30,
                  opacity: { duration: 0.2 },
                }}
                style={{
                  originX: 1,
                  originY: 1,
                  zIndex: activeTabId === tab.id ? 10 : index,
                }}
                className={
                  tab.isMinimized
                    ? 'cursor-pointer'
                    : 'bg-background overflow-hidden rounded-lg border shadow-2xl'
                }
              >
                <AnimatePresence mode="wait">
                  {tab.isMinimized ? (
                    <motion.div
                      key={`${tab.id}-minimized`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="hover:bg-accent flex h-10 items-center gap-2 rounded-lg border bg-[#FFFFFF] px-4 py-2 shadow-lg dark:bg-[#202020]"
                      onClick={() => toggleMinimize(tab.id)}
                    >
                      <span className="text-sm font-medium">
                        {tab.subject ||
                          (tab.to?.length
                            ? `To: ${tab.to[0]}${tab.to.length > 1 ? ` +${tab.to.length - 1}` : ''}`
                            : 'New Email')}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-destructive/10 h-5 w-5 rounded-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTab(tab.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`${tab.id}-expanded`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex h-full flex-col"
                      onClick={() => setActiveTabId(tab.id)}
                    >
                      <div className="dark:bg-panelDark flex items-center justify-between border-b p-2 pr-1.5">
                        <h3 className="text-sm font-medium">{tab.subject || 'New Email'}</h3>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleMinimize(tab.id)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleFullscreen(tab.id)}
                          >
                            <Maximize2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTab(tab.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="dark:bg-panelDark flex-1 overflow-y-auto">
                        <ComposeTabContent
                          tab={tab}
                          tabId={tab.id}
                          onSendEmail={handleSendEmail}
                          onChange={(updates) => updateTab({ id: tab.id, updates })}
                          updateTab={updateTab}
                          settingsLoading={settingsLoading}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-lg border bg-[#FFFFFF] dark:bg-[#202020]"
            onClick={handleAddTab}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>
    </>
  );
}
