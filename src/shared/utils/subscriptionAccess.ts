/**
 * Access-control utility for evaluating synced Stripe subscription data.
 *
 * Call `hasActiveSubscription` with the row fetched from the
 * `stripe_subscriptions` table to determine whether the user currently holds
 * an active entitlement.
 */

export interface StripeSubscriptionData {
  /** Stripe subscription status (e.g. 'active', 'trialing', 'canceled'). */
  subscription_status: string;
  /**
   * True when the subscription is scheduled to cancel at the end of the
   * current billing period rather than immediately.
   */
  subscription_cancel_at_period_end: boolean;
  /**
   * ISO-8601 timestamp marking the end of the current billing period.
   * Required to gate access when `subscription_cancel_at_period_end` is true.
   */
  subscription_current_period_end: string | null;
}

/**
 * Returns `true` when the user has an active subscription entitlement.
 *
 * Rules (in evaluation order):
 * 1. The subscription must have a status of `'active'` or `'trialing'`.
 * 2. Cancellation edge-case: when `subscription_cancel_at_period_end` is
 *    `true` the subscription is still active but will not renew.  Access is
 *    retained until the `subscription_current_period_end` timestamp is
 *    reached; after that moment `false` is returned.
 */
export function hasActiveSubscription(record: StripeSubscriptionData): boolean {
  const {
    subscription_status,
    subscription_cancel_at_period_end,
    subscription_current_period_end,
  } = record;

  if (subscription_status !== 'active' && subscription_status !== 'trialing') {
    return false;
  }

  if (subscription_cancel_at_period_end) {
    if (!subscription_current_period_end) {
      return false;
    }
    const periodEnd = new Date(subscription_current_period_end).getTime();
    if (Number.isNaN(periodEnd)) {
      return false;
    }
    return Date.now() < periodEnd;
  }

  return true;
}
