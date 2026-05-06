// supabase/functions/summarize-memory/index.ts
// Deno Edge Function — recursive summarization to prevent narrative drift.
//
// POST /summarize-memory
// Body: { campaign_id: string, old_summary: string, new_events: string[] }
// Returns: { summary: string }
// Side-effect: updates campaigns.memory_summary for the given campaign_id.

import OpenAI from "npm:openai@^4";
import { z } from "npm:zod@^3";
import { zodResponseFormat } from "npm:openai@^4/helpers/zod";
import { createClient } from "npm:@supabase/supabase-js@^2";

// ─── CORS helpers ─────────────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Zod schema for structured output ────────────────────────────────────────

const MemorySummarySchema = z.object({
  summary: z
    .string()
    .describe(
      "An updated narrative memory. Must be clear, concise, and contain no more than 20 sentences.",
    ),
});

export type MemorySummary = z.infer<typeof MemorySummarySchema>;

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(oldSummary: string, newEvents: string[]): string {
  const eventsBlock = newEvents.map((e, i) => `  ${i + 1}. ${e}`).join("\n");

  return `You are an expert narrative archivist for a living, AI-driven RPG world.
Your task is to merge an existing memory summary with newly observed events into a single, updated memory.

Follow these steps precisely:
1. Extract key personality data (character traits, motivations, relationships) and world facts (locations, factions, ongoing quests, established lore) from the OLD SUMMARY.
2. Identify new information introduced by the NEW EVENTS that is not already captured in the old summary.
3. Combine the retained information with the new information into a single coherent updated memory.
4. The final output must be clear, concise, and STRICTLY no more than 20 sentences.
5. Preserve continuity: do not contradict established facts unless a new event explicitly overrides them.
6. Omit minor or redundant details to stay within the sentence limit.
7. Return ONLY the JSON object described by the schema — no prose, no markdown fences.

--- OLD SUMMARY ---
${oldSummary || "(none — this is the first session)"}

--- NEW EVENTS ---
${eventsBlock || "(none provided)"}`;
}

// ─── Edge Function entry point ────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS pre-flight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Parse and validate request body ──────────────────────────────────────
  let campaignId: string;
  let oldSummary: string;
  let newEvents: string[];

  try {
    const body = await req.json();

    if (typeof body?.campaign_id !== "string" || body.campaign_id.trim() === "") {
      throw new Error("Request body must contain a non-empty 'campaign_id' string");
    }
    if (typeof body?.old_summary !== "string") {
      throw new Error("Request body must contain an 'old_summary' string (may be empty)");
    }
    if (!Array.isArray(body?.new_events) || !body.new_events.every((e: unknown) => typeof e === "string")) {
      throw new Error("Request body must contain a 'new_events' array of strings");
    }

    campaignId = body.campaign_id.trim();
    oldSummary = body.old_summary;
    newEvents = body.new_events as string[];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid JSON body";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Build OpenAI client ───────────────────────────────────────────────────
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not set" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const openai = new OpenAI({ apiKey });

  // ── Call OpenAI with structured outputs enforced via Zod schema ───────────
  let memorySummary: MemorySummary;
  try {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        { role: "system", content: buildSystemPrompt(oldSummary, newEvents) },
        {
          role: "user",
          content: "Generate the updated memory summary JSON now. Follow the schema exactly.",
        },
      ],
      response_format: zodResponseFormat(MemorySummarySchema, "memory_summary"),
      temperature: 0.3,
      max_tokens: 1024,
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new Error("OpenAI returned an empty or refusal response");
    }
    memorySummary = parsed;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "OpenAI request failed";
    console.error("[summarize-memory] OpenAI error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Persist the new summary to the campaigns table ────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Supabase environment variables are not set" }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { error: dbError } = await supabase
    .from("campaigns")
    .update({ memory_summary: memorySummary.summary })
    .eq("id", campaignId);

  if (dbError) {
    console.error("[summarize-memory] DB update error:", dbError.message);
    return new Response(JSON.stringify({ error: dbError.message }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ summary: memorySummary.summary }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
