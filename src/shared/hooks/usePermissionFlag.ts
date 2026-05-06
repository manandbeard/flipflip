/**
 * usePermissionFlag — TanStack Query hook that fetches the authenticated user's
 * subscription access status from Supabase and returns a boolean permission flag.
 *
 * Returns:
 *   isPermitted  – true when the user has an active/trialing subscription.
 *   isLoading    – true while the query is in flight.
 *   error        – any error thrown during the fetch.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/utils/supabaseClient';
import {
  hasActiveSubscription,
  type StripeSubscriptionData,
} from '@/shared/utils/subscriptionAccess';

async function fetchPermissionFlag(): Promise<boolean> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return false;
  }

  const { data, error } = await supabase
    .from('stripe_subscriptions')
    .select(
      'subscription_status, subscription_cancel_at_period_end, subscription_current_period_end',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return hasActiveSubscription(data as StripeSubscriptionData);
}

export function usePermissionFlag() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['permission-flag'],
    queryFn: fetchPermissionFlag,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    isPermitted: data ?? false,
    isLoading,
    error,
  };
}
