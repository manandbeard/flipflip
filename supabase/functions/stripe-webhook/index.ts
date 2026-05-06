// supabase/functions/stripe-webhook/index.ts
// Deno Edge Function — Stripe Sync Engine & Webhook Listener (Phase 4: Monetization).
//
// POST /stripe-webhook
// Headers: stripe-signature (required)
// Body:    raw Stripe event payload
//
// Listens for:
//   checkout.session.completed
//   customer.subscription.created
//   customer.subscription.updated
//   customer.subscription.deleted
//
// On each handled event the function verifies the Stripe webhook signature and
// upserts the event payload into the corresponding Supabase table so the rest of
// the application always has an up-to-date mirror of the customer's billing state.

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";

// ─── Event allow-list ─────────────────────────────────────────────────────────

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

// ─── Database sync helpers ────────────────────────────────────────────────────

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Upsert a Stripe Subscription object into the `stripe_subscriptions` table.
 * The full Stripe object is stored in the `data` JSONB column so the schema
 * remains forward-compatible with new Stripe fields without migrations.
 */
async function syncSubscription(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  const { error } = await supabase.from("stripe_subscriptions").upsert(
    {
      id: subscription.id,
      customer_id: subscription.customer as string,
      status: subscription.status,
      price_id: subscription.items.data[0]?.price?.id ?? null,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      data: subscription,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`stripe_subscriptions upsert failed: ${error.message}`);
  }
}

/**
 * Upsert a completed Stripe Checkout Session into the
 * `stripe_checkout_sessions` table.
 */
async function syncCheckoutSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const { error } = await supabase.from("stripe_checkout_sessions").upsert(
    {
      id: session.id,
      // customer / subscription are string IDs when the session is retrieved
      // via webhook (Stripe does not auto-expand objects in webhook payloads).
      customer_id: typeof session.customer === "string" ? session.customer : null,
      subscription_id: typeof session.subscription === "string" ? session.subscription : null,
      payment_status: session.payment_status,
      status: session.status,
      amount_total: session.amount_total,
      currency: session.currency,
      data: session,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`stripe_checkout_sessions upsert failed: ${error.message}`);
  }
}

// ─── Event dispatcher ─────────────────────────────────────────────────────────

async function syncEventToDatabase(
  supabase: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await syncCheckoutSession(supabase, event.data.object as Stripe.Checkout.Session);
      break;

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(supabase, event.data.object as Stripe.Subscription);
      break;

    default:
      // Should never reach here due to the early-exit guard above, but keeps
      // the switch exhaustive so TypeScript remains happy if we extend later.
      break;
  }
}

// ─── Edge Function entry point ────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Validate required environment variables ───────────────────────────────
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeSecretKey || !stripeWebhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error("[stripe-webhook] One or more required environment variables are missing");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Read raw body for signature verification ──────────────────────────────
  // The body MUST be consumed as raw text before parsing; Stripe's signature
  // check is performed over the exact bytes received, not a re-serialised JSON.
  const rawBody = await req.text();

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Verify Stripe webhook signature ──────────────────────────────────────
  const stripe = new Stripe(stripeSecretKey);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      stripeWebhookSecret,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    console.error("[stripe-webhook] Signature error:", message);
    return new Response(
      JSON.stringify({ error: `Webhook signature verification failed: ${message}` }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // ── Skip unhandled event types ────────────────────────────────────────────
  if (!HANDLED_EVENTS.has(event.type)) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Sync payload to Supabase ──────────────────────────────────────────────
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    await syncEventToDatabase(supabase, event);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database sync failed";
    console.error(`[stripe-webhook] Sync error for event ${event.id} (${event.type}):`, message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[stripe-webhook] Successfully synced event ${event.id} (${event.type})`);
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
