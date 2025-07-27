import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Trash, Plus, CheckCircle, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SettingsCard } from '@/components/settings/settings-card';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router';
import { useState } from 'react';
import { toast } from 'sonner';

export default function DomainsPage() {
  const [newDomain, setNewDomain] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const trpc = useTRPC();
  const { data: domains, isLoading, refetch } = useQuery(trpc.domains.list.queryOptions());
  const { mutateAsync: addDomain, isPending: isAdding } = useMutation(
    trpc.domains.add.mutationOptions(),
  );
  const { mutateAsync: verifyDomain, isPending: isVerifying } = useMutation(
    trpc.domains.verify.mutationOptions(),
  );
  const { mutateAsync: deleteDomain } = useMutation(trpc.domains.delete.mutationOptions());

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;

    try {
      await addDomain({ domain: newDomain.trim() });
      toast.success(`Domain ${newDomain} added successfully`);
      setNewDomain('');
      setIsAddDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add domain');
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    try {
      const result = await verifyDomain({ domainId });
      if (result.verified) {
        toast.success('Domain verified successfully');
      } else {
        toast.info('Domain verification is still pending');
      }
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify domain');
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    try {
      await deleteDomain({ domainId });
      toast.success('Domain deleted successfully');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete domain');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="grid gap-6">
      <SettingsCard
        title="Custom Domains"
        description="Manage your custom domains for receiving emails through Amazon SES"
      >
        <div className="space-y-6">
          {isLoading ? (
            <div className="grid gap-4">
              {[...Array(2)].map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="bg-popover flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="flex flex-col gap-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <Skeleton className="ml-4 h-8 w-8 rounded-full" />
                </div>
              ))}
            </div>
          ) : domains?.length ? (
            <div className="grid gap-4">
              {domains.map((domain) => (
                <Card key={domain.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                          {domain.verified ? (
                            <CheckCircle className="size-5 text-green-600" />
                          ) : (
                            <AlertCircle className="size-5 text-yellow-600" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-base">{domain.domain}</CardTitle>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant={domain.verified ? 'default' : 'secondary'}>
                              {domain.verified ? 'Verified' : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link to={`/settings/domains/${domain.id}/accounts`}>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Manage Users
                          </Button>
                        </Link>
                        {!domain.verified && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVerifyDomain(domain.id)}
                            disabled={isVerifying}
                          >
                            {isVerifying ? 'Checking...' : 'Verify'}
                          </Button>
                        )}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-primary"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent showOverlay>
                            <DialogHeader>
                              <DialogTitle>Delete Domain</DialogTitle>
                              <DialogDescription>
                                Are you sure you want to delete {domain.domain}? This will also
                                delete all associated email accounts.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex justify-end gap-4">
                              <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button onClick={() => handleDeleteDomain(domain.id)}>
                                  Delete
                                </Button>
                              </DialogClose>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardHeader>
                  {domain.verificationToken && !domain.verified && (
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-sm">
                          Add this TXT record to your DNS:
                        </p>
                        <div className="bg-muted flex items-center gap-2 rounded p-2 font-mono text-xs">
                          <span className="flex-1 truncate">{domain.verificationToken}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-1"
                            onClick={() => copyToClipboard(domain.verificationToken!)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No domains configured yet</p>
            </div>
          )}

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-fit">
                <Plus className="mr-2 h-4 w-4" />
                Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent showOverlay>
              <DialogHeader>
                <DialogTitle>Add Custom Domain</DialogTitle>
                <DialogDescription>
                  Add a custom domain to receive emails through Amazon SES
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="domain">Domain Name</Label>
                  <Input
                    id="domain"
                    placeholder="example.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-4">
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleAddDomain} disabled={isAdding || !newDomain.trim()}>
                    {isAdding ? 'Adding...' : 'Add Domain'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </SettingsCard>
    </div>
  );
}
