'use client';

import {
  useSubscriptions,
  type SubscriptionItem,
  type SubscriptionCategory,
  categoryColors,
  categoryLabels,
} from '@/hooks/use-subscriptions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCcw, Mail, MailOpen, Search, Trash2 } from 'lucide-react';
import { EmptyStateIcon } from '@/components/icons/empty-state-svg';
import { SidebarToggle } from '@/components/ui/sidebar-toggle';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate } from '@/lib/utils';
import { VList } from 'virtua';

function SubscriptionItemComponent({
  subscription,
  onUnsubscribe,
  onResubscribe,
  isLoading,
}: {
  subscription: SubscriptionItem;
  onUnsubscribe: (id: string) => void;
  onResubscribe: (id: string) => void;
  isLoading: boolean;
}) {
  const getDomainIcon = (domain: string) => {
    const firstLetter = domain.charAt(0).toUpperCase();
    return (
      <Avatar className="h-10 w-10 rounded-lg">
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300 text-sm font-semibold text-neutral-700 dark:from-neutral-700 dark:to-neutral-800 dark:text-neutral-300">
          {firstLetter}
        </div>
      </Avatar>
    );
  };

  return (
    <Card className="mb-3 transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {getDomainIcon(subscription.senderDomain)}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="truncate text-sm font-medium">
                  {subscription.senderName || subscription.senderEmail}
                </h3>
                <p className="text-muted-foreground truncate text-xs">{subscription.senderEmail}</p>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-xs',
                    categoryColors[subscription.category as SubscriptionCategory],
                  )}
                >
                  {categoryLabels[subscription.category as SubscriptionCategory]}
                </Badge>

                {subscription.isActive ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUnsubscribe(subscription.id)}
                    disabled={isLoading}
                    className="h-8 px-2"
                  >
                    <MailOpen className="mr-1 h-4 w-4" />
                    Unsubscribe
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onResubscribe(subscription.id)}
                    disabled={isLoading}
                    className="h-8 px-2"
                  >
                    <Mail className="mr-1 h-4 w-4" />
                    Resubscribe
                  </Button>
                )}
              </div>
            </div>

            <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
              <span>{subscription.emailCount} emails</span>
              <span>Last: {formatDate(new Date(subscription.lastEmailReceivedAt))}</span>
              {subscription.metadata?.lastSubject && (
                <span className="max-w-xs truncate">"{subscription.metadata.lastSubject}"</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SubscriptionsPage() {
  const {
    subscriptions,
    stats,
    selectedIds,
    isLoading,
    isUnsubscribing,
    isResubscribing,
    isBulkUnsubscribing,
    searchQuery,
    categoryFilter,
    activeFilter,
    setSearchQuery,
    setCategoryFilter,
    setActiveFilter,
    handleUnsubscribe,
    handleResubscribe,
    handleBulkUnsubscribe,
    refetch,
  } = useSubscriptions();

  // const stats = {
  //   overall: {
  //     total: 0,
  //     active: 0,
  //     inactive: 0,
  //   },
  // };

  return (
    <div className="rounded-inherit relative z-[5] flex p-0 md:mr-1 md:mt-1">
      <div className="rounded-inherit h-full w-full overflow-hidden">
        <div className="bg-panelLight dark:bg-panelDark mb-1 block w-full shadow-sm md:mr-[3px] md:rounded-2xl lg:flex lg:h-[calc(100dvh-8px)] lg:shadow-sm">
          <div className="w-full md:h-[calc(100dvh-10px)]">
            <div className="relative z-[1] h-[calc(100dvh-(2px+2px))] w-full overflow-hidden pt-0">
              <div>
                <div
                  className={cn(
                    'sticky top-0 z-[15] flex items-center justify-between gap-1.5 p-2 pb-0 transition-colors',
                  )}
                >
                  <div className="w-full">
                    <div className="mt-1 flex justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <SidebarToggle className="col-span-1 h-fit w-10 px-2" />
                        <h1 className="text-lg font-semibold">Subscriptions</h1>
                      </div>

                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                          <Input
                            placeholder="Search subscriptions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                          />
                        </div>

                        <Select
                          value={categoryFilter}
                          onValueChange={(v) => setCategoryFilter(v as any)}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {Object.entries(categoryLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={activeFilter}
                          onValueChange={(v) => setActiveFilter(v as any)}
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Unsubscribed</SelectItem>
                          </SelectContent>
                        </Select>

                        {selectedIds.size > 0 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBulkUnsubscribe}
                            disabled={isBulkUnsubscribing}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Unsubscribe ({selectedIds.size})
                          </Button>
                        )}
                        <Button
                          onClick={() => {
                            // refetchThreads();
                            refetch();
                          }}
                          variant="ghost"
                          className="md:h-fit md:px-2"
                        >
                          <RefreshCcw className="text-muted-foreground h-4 w-4 cursor-pointer" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {stats && (
                  <div className="mb-4 grid grid-cols-3 gap-4 p-2 px-3">
                    <Card>
                      <CardHeader className="p-3">
                        <CardTitle className="text-sm font-medium">Total</CardTitle>
                        <CardDescription className="text-2xl font-bold">
                          {stats?.overall?.total || 0}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="p-3">
                        <CardTitle className="text-sm font-medium">Active</CardTitle>
                        <CardDescription className="text-2xl font-bold text-green-600">
                          {stats?.overall?.active || 0}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="p-3">
                        <CardTitle className="text-sm font-medium">Unsubscribed</CardTitle>
                        <CardDescription className="text-2xl font-bold text-red-600">
                          {stats?.overall?.inactive || 0}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </div>
                )}
              </div>

              {/* List */}
              <div className="h-[calc(100dvh-150px)] overflow-auto p-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Card key={`skeleton-${i}`}>
                        <CardContent className="p-4">
                          <Skeleton className="h-16 w-full" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : subscriptions.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-center">
                      <EmptyStateIcon width={200} height={200} />
                      <h3 className="mt-4 text-lg font-medium">No subscriptions found</h3>
                      <p className="text-muted-foreground text-sm">
                        {searchQuery
                          ? 'Try adjusting your search or filters'
                          : 'Your subscriptions will appear here as they are detected'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <VList className="w-full">
                    {subscriptions.map((subscription: SubscriptionItem) => (
                      <SubscriptionItemComponent
                        key={subscription.id}
                        subscription={subscription}
                        onUnsubscribe={handleUnsubscribe}
                        onResubscribe={handleResubscribe}
                        isLoading={isUnsubscribing || isResubscribing}
                      />
                    ))}
                  </VList>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
