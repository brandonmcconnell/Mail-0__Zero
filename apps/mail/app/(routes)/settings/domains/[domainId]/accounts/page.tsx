import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { SettingsCard } from '@/components/settings/settings-card';
import { useTRPC } from '@/providers/query-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Trash, Plus, User, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { toast } from 'sonner';
import { Link, useParams } from 'react-router';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

export default function DomainAccountsPage() {
  const { domainId } = useParams();
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const trpc = useTRPC();
  const { data: accounts, isLoading, refetch } = useQuery(
    trpc.domains.listAccounts.queryOptions({ domainId: domainId! })
  );
  const { mutateAsync: addAccount, isPending: isAdding } = useMutation(
    trpc.domains.addAccount.mutationOptions()
  );
  const { mutateAsync: deleteAccount } = useMutation(
    trpc.domains.deleteAccount.mutationOptions()
  );

  const handleAddAccount = async () => {
    if (!newEmail.trim()) return;

    try {
      await addAccount({
        domainId: domainId!,
        email: newEmail.trim(),
        name: newName.trim() || undefined,
      });
      toast.success(`Email account ${newEmail} added successfully`);
      setNewEmail('');
      setNewName('');
      setIsAddDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add email account');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      await deleteAccount({ accountId });
      toast.success('Email account deleted successfully');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete email account');
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <Link to="/settings/domains">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Domains
          </Button>
        </Link>
      </div>

      <SettingsCard
        title="Domain Email Accounts"
        description="Manage email accounts for this domain"
      >
        <div className="space-y-6">
          {isLoading ? (
            <div className="grid gap-4">
              {[...Array(3)].map((_, i) => (
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
          ) : accounts?.length ? (
            <div className="grid gap-4">
              {accounts.map((account) => (
                <Card key={account.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                          <User className="size-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {account.name || account.email}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground truncate">{account.email}</span>
                            <Badge variant={account.active ? 'default' : 'secondary'}>
                              {account.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                            <Trash className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent showOverlay>
                          <DialogHeader>
                            <DialogTitle>Delete Email Account</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete {account.email}? This action cannot be undone.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex justify-end gap-4">
                            <DialogClose asChild>
                              <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button onClick={() => handleDeleteAccount(account.id)}>Delete</Button>
                            </DialogClose>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No email accounts configured yet</p>
            </div>
          )}

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-fit">
                <Plus className="h-4 w-4 mr-2" />
                Add Email Account
              </Button>
            </DialogTrigger>
            <DialogContent showOverlay>
              <DialogHeader>
                <DialogTitle>Add Email Account</DialogTitle>
                <DialogDescription>
                  Add a new email account for this domain
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@domain.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="name">Display Name (Optional)</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-4">
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleAddAccount} disabled={isAdding || !newEmail.trim()}>
                    {isAdding ? 'Adding...' : 'Add Account'}
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
