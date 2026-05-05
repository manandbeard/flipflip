// supabase/functions/generate-world/index.ts
// Deno Edge Function — generates an RPG level via OpenAI Structured Outputs.
//
// POST /generate-world
// Body: { profile: PersonalityProfile }
// Returns: { npcs: NPC[], tiled_map_data: TiledMapData }

import OpenAI from "npm:openai@^4";
import { z } from "npm:zod@^3";
import { zodResponseFormat } from "npm:openai@^4/helpers/zod";

// ─── CORS helpers ────────────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const NpcSchema = z.object({
  id: z.string().describe("Unique identifier for this NPC, e.g. 'npc_01'"),
  name: z.string().describe("Display name shown to the player"),
  archetype: z
    .enum(["merchant", "guard", "sage", "wanderer", "villager", "enemy"])
    .describe("Role archetype that governs behaviour and dialogue tone"),
  personality_traits: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Short adjectives describing this NPC's personality"),
  greeting: z.string().describe("Opening line the NPC says when first approached"),
  lore_snippet: z
    .string()
    .describe("One to three sentences of world lore this NPC can share"),
  tile_position: z.object({
    x: z.number().int().describe("Tile column (0-indexed)"),
    y: z.number().int().describe("Tile row (0-indexed)"),
  }),
});

const TileLayerSchema = z.object({
  name: z.string().describe("Layer name, e.g. 'ground', 'collision', 'objects'"),
  type: z.enum(["tilelayer", "objectgroup"]),
  data: z
    .array(z.number().int())
    .describe(
      "Flat array of tile GIDs (row-major). Length must equal width * height. Use 0 for empty tiles.",
    ),
});

const TiledMapDataSchema = z.object({
  width: z.number().int().min(10).max(64).describe("Map width in tiles"),
  height: z.number().int().min(10).max(64).describe("Map height in tiles"),
  tile_width: z.number().int().default(32).describe("Pixel width of each tile"),
  tile_height: z.number().int().default(32).describe("Pixel height of each tile"),
  tileset_key: z
    .string()
    .describe("Asset key used to look up the tileset in Phaser's cache"),
  layers: z
    .array(TileLayerSchema)
    .min(1)
    .describe("Ordered list of tile layers (bottom-most first)"),
  spawn_point: z.object({
    x: z.number().int().describe("Player spawn tile column"),
    y: z.number().int().describe("Player spawn tile row"),
  }),
  ambient_theme: z
    .string()
    .describe("One-word mood descriptor used to select ambient music, e.g. 'mystical'"),
});

const WorldSchema = z.object({
  npcs: z.array(NpcSchema).min(1).max(8).describe("NPCs to populate this level"),
  tiled_map_data: TiledMapDataSchema.describe("Tiled-compatible map descriptor"),
});

// ─── Types inferred from schema ───────────────────────────────────────────────

export type World = z.infer<typeof WorldSchema>;

// ─── Personality profile shape (sent by the client) ──────────────────────────

interface PersonalityProfile {
  /** e.g. ["curious", "introverted", "analytical"] */
  traits: string[];
  /** Preferred play-style, e.g. "explorer", "fighter", "diplomat" */
  play_style?: string;
  /** Favourite genre or setting keywords, e.g. "dark fantasy" */
  genre_preference?: string;
  /** Any free-form notes from the questionnaire */
  notes?: string;
}

// ─── System prompt factory ───────────────────────────────────────────────────

function buildSystemPrompt(profile: PersonalityProfile): string {
  const traits = profile.traits.join(", ");
  const playStyle = profile.play_style ?? "explorer";
  const genre = profile.genre_preference ?? "classic fantasy";
  const notes = profile.notes ? `\nAdditional context: ${profile.notes}` : "";

  return `You are an expert RPG world designer.
Generate a single, self-contained RPG level tailored to a player with the following profile:
  - Personality traits: ${traits}
  - Preferred play style: ${playStyle}
  - Genre / setting preference: ${genre}${notes}

Guidelines:
1. The map should feel coherent and playable — include at least a ground layer and a collision layer.
2. Each NPC must have a distinct personality that complements or contrasts the player's traits in an interesting way.
3. Dialogue and lore should reflect the chosen genre.
4. The spawn point must be placed on a walkable tile (not blocked by collision layer).
5. Return ONLY the JSON object described by the schema — no prose, no markdown fences.`;
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

  // Parse request body
  let profile: PersonalityProfile;
  try {
    const body = await req.json();
    if (!body?.profile || !Array.isArray(body.profile.traits)) {
      throw new Error("Request body must contain { profile: { traits: string[] } }");
    }
    profile = body.profile as PersonalityProfile;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid JSON body";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Build OpenAI client — key comes from environment
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not set" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const openai = new OpenAI({ apiKey });

  // Call OpenAI with structured outputs enforced via Zod schema
  let world: World;
  try {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        { role: "system", content: buildSystemPrompt(profile) },
        {
          role: "user",
          content:
            "Generate the RPG level JSON now. Follow the schema exactly.",
        },
      ],
      response_format: zodResponseFormat(WorldSchema, "world"),
      temperature: 0.8,
      // A 64×64 map with two layers produces ~8 k tile integers; 4096 tokens
      // is a safe minimum ceiling — increase if you allow larger maps.
      max_tokens: 4096,
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new Error("OpenAI returned an empty or refusal response");
    }
    world = parsed;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "OpenAI request failed";
    console.error("[generate-world] OpenAI error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(world), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
