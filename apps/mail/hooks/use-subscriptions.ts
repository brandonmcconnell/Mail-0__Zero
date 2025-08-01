import { useState, useCallback, useMemo, useEffect } from 'react';
import { useActiveConnection } from '@/hooks/use-connections';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';

export type SubscriptionCategory =
  | 'newsletter'
  | 'promotional'
  | 'social'
  | 'development'
  | 'transactional'
  | 'general';

export interface SubscriptionItem {
  id: string;
  senderEmail: string;
  senderName?: string | null;
  senderDomain: string;
  category: SubscriptionCategory;
  listUnsubscribeUrl?: string | null;
  listUnsubscribePost?: string | null;
  lastEmailReceivedAt: Date;
  emailCount: number;
  isActive: boolean;
  userUnsubscribedAt?: Date | null;
  autoArchive: boolean;
  metadata?: any;
  createdAt: Date;
}

export const categoryColors: Record<SubscriptionCategory, string> = {
  newsletter: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  promotional: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  social: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  development: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  transactional: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  general: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

export const categoryLabels: Record<SubscriptionCategory, string> = {
  newsletter: 'Newsletter',
  promotional: 'Promotional',
  social: 'Social',
  development: 'Development',
  transactional: 'Transactional',
  general: 'General',
};

export const useSubscriptions = () => {
  const { data: activeConnection } = useActiveConnection();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<SubscriptionCategory | 'all'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const trpc = useTRPC();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch subscriptions list
  const subscriptionsQuery = useQuery(
    trpc.subscriptions.list.queryOptions(
      {
        connectionId: activeConnection?.id || '',
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
        limit: 100,
      },
      {
        enabled: !!activeConnection?.id,
      },
    ),
  );

  // Fetch subscription stats
  const statsQuery = useQuery(
    trpc.subscriptions.stats.queryOptions(
      {
        connectionId: activeConnection?.id,
      },
      {
        enabled: !!activeConnection?.id,
      },
    ),
  );

  // Mutations
  const unsubscribeMutation = useMutation({
    ...trpc.subscriptions.unsubscribe.mutationOptions(),
    onSuccess: (result, _variables) => {
      void subscriptionsQuery.refetch();

      // Handle List-Unsubscribe action if available
      if (result.unsubscribeAction) {
        const action = result.unsubscribeAction;
        if (action.type === 'get' && action.url) {
          window.open(action.url, '_blank');
        }
        // For 'post' and 'email' types, we'd need additional UI
      }
    },
  });

  const resubscribeMutation = useMutation({
    ...trpc.subscriptions.resubscribe.mutationOptions(),
    onSuccess: () => {
      void subscriptionsQuery.refetch();
    },
  });

  const bulkUnsubscribeMutation = useMutation({
    ...trpc.subscriptions.bulkUnsubscribe.mutationOptions(),
    onSuccess: () => {
      void subscriptionsQuery.refetch();
      setSelectedIds(new Set());
    },
  });

  // Filter subscriptions based on search query
  const filteredSubscriptions = useMemo(() => {
    if (!subscriptionsQuery.data?.items) return [] as SubscriptionItem[];

    return subscriptionsQuery.data.items.filter((sub) => {
      if (!debouncedSearch) return true;
      const searchLower = debouncedSearch.toLowerCase();
      return (
        sub.senderEmail.toLowerCase().includes(searchLower) ||
        sub.senderName?.toLowerCase().includes(searchLower) ||
        sub.senderDomain.toLowerCase().includes(searchLower) ||
        sub.metadata?.lastSubject?.toLowerCase().includes(searchLower)
      );
    });
  }, [subscriptionsQuery.data, debouncedSearch]);

  // Action handlers
  const handleUnsubscribe = useCallback(
    (id: string) => {
      if (!activeConnection?.id) return;
      unsubscribeMutation.mutate({
        subscriptionId: id,
        connectionId: activeConnection.id,
      });
    },
    [activeConnection?.id, unsubscribeMutation],
  );

  const handleResubscribe = useCallback(
    (id: string) => {
      if (!activeConnection?.id) return;
      resubscribeMutation.mutate({
        subscriptionId: id,
        connectionId: activeConnection.id,
      });
    },
    [activeConnection?.id, resubscribeMutation],
  );

  const handleBulkUnsubscribe = useCallback(() => {
    if (selectedIds.size === 0 || !activeConnection?.id) return;
    bulkUnsubscribeMutation.mutate({
      subscriptionIds: Array.from(selectedIds),
      connectionId: activeConnection.id,
    });
  }, [selectedIds, activeConnection?.id, bulkUnsubscribeMutation]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    // Data
    subscriptions: filteredSubscriptions,
    stats: statsQuery.data as
      | {
          overall: {
            total: number;
            active: number;
            inactive: number;
            avgEmailsPerSubscription: number;
          };
          byCategory: any[];
          recentActivity: any;
        }
      | undefined,
    selectedIds,

    // Loading states
    isLoading: subscriptionsQuery.isLoading,
    isLoadingStats: statsQuery.isLoading,
    isUnsubscribing: unsubscribeMutation.isPending,
    isResubscribing: resubscribeMutation.isPending,
    isBulkUnsubscribing: bulkUnsubscribeMutation.isPending,

    // Filters
    searchQuery,
    categoryFilter,
    activeFilter,

    // Actions
    setSearchQuery,
    setCategoryFilter,
    setActiveFilter,
    handleUnsubscribe,
    handleResubscribe,
    handleBulkUnsubscribe,
    toggleSelection,
    clearSelection,
    refetch: subscriptionsQuery.refetch,
    refetchStats: statsQuery.refetch,
  };
};
