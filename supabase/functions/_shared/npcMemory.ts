// supabase/functions/_shared/npcMemory.ts
// Shared utility — NPC memory decay via the FSRS spaced-repetition algorithm.
//
// Usage (from another Edge Function):
//
//   import {
//     calculateRetrievability,
//     getRetrievabilityScore,
//   } from "../_shared/npcMemory.ts";
//   import type { FSRSState } from "../_shared/npcMemory.ts";
//
// Typical workflow:
//   1. Persist an FSRSState alongside every NPC interaction in the database.
//   2. Before building an LLM prompt, call calculateRetrievability() for each
//      stored memory; omit any that return false.

import { createEmptyCard, fsrs, State } from "npm:ts-fsrs@^5";
import type { Card } from "npm:ts-fsrs@^5";

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Minimal FSRS state that should be persisted per NPC interaction.
 *
 * These two parameters are the core outputs of the FSRS algorithm and fully
 * describe how a memory decays over time:
 *   - `stability`: the review interval (in days) at which retrievability equals
 *     90 %. Right after a review R = 100 %; after `stability` days it has
 *     decayed TO 90 %; it continues falling from there.
 *   - `difficulty`: intrinsic difficulty of the memory (1–10 scale).
 *
 * Important: this type is intended for **previously-reinforced** memories whose
 * stability/difficulty have already been computed by the FSRS scheduler. The
 * utility functions below treat every memory as `State.Review` (past-reinforced)
 * and calculate how much it has decayed since `elapsedDays` ago. Do not pass
 * zero-valued defaults for brand-new, un-reviewed interactions — initialise them
 * via `fsrs().repeat()` first to obtain valid stability/difficulty values.
 *
 * Sensible starting values after a first successful reinforcement, e.g.:
 *   { stability: 1.0, difficulty: 5.0 }
 */
export interface FSRSState {
  /**
   * Stability (S) — the review interval (days) at which R(t) = 90 %.
   * Right after a review R = 100 %; after `stability` days R has dropped TO 90 %.
   */
  stability: number;
  /** Difficulty (D) — intrinsic memory difficulty on a 1–10 scale. */
  difficulty: number;
}

/** Retrievability expressed as a probability in [0, 1]. */
export type Retrievability = number;

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Probability-of-recall threshold below which a memory is considered forgotten.
 * 50 % matches the FSRS "half-life" convention and is a pragmatic NPC default:
 * an NPC with a sub-50 % chance of recall would plausibly not bring the event up
 * unprompted. Raise to 0.7 for highly reliable NPCs; lower to 0.3 for forgetful
 * ones.
 */
const RECALL_THRESHOLD: Retrievability = 0.5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a synthetic FSRS Card from a persisted FSRSState so we can pass it to
 * the scheduler without needing the full scheduling history.
 */
function hydrateCard(memoryState: FSRSState, lastReview: Date): Card {
  return {
    ...createEmptyCard(lastReview),
    stability: memoryState.stability,
    difficulty: memoryState.difficulty,
    state: State.Review,      // previously reinforced — not a brand-new memory
    last_review: lastReview,
    scheduled_days: 0,        // unknown; elapsed_days drives the calculation
    elapsed_days: 0,          // set dynamically in the callers via lastReview offset
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the probability (0 → 1) that an NPC still recalls a past interaction.
 *
 * The scheduler is initialised with `fsrs({ enable_fuzz: false })` for
 * deterministic results. The FSRS forgetting-curve formula:
 *
 *   R(t) = ( 1 + FACTOR × t / S ) ^ DECAY
 *
 * is applied by `scheduler.get_retrievability()`, which projects the next_state
 * and next_interval and reads back the resulting recall probability.
 *
 * @param memoryState  FSRS stability + difficulty stored for this NPC memory.
 * @param elapsedDays  Days since the memory was last reinforced (≥ 0).
 * @returns Retrievability in [0, 1]. Higher is better recalled.
 */
export function getRetrievabilityScore(
  memoryState: FSRSState,
  elapsedDays: number,
): Retrievability {
  const scheduler = fsrs({ enable_fuzz: false });

  const now = new Date();
  const lastReview = new Date(now.getTime() - elapsedDays * 86_400_000);
  const card = hydrateCard(memoryState, lastReview);

  // scheduler.get_retrievability() returns a locale-independent string such as
  // "82.56%" — strip the "%" suffix explicitly before parsing to avoid any
  // ambiguity about parseFloat's non-numeric character truncation behaviour.
  const raw: string = scheduler.get_retrievability(card, now);
  return parseFloat(raw.replace("%", "")) / 100;
}

/**
 * Calculates whether an NPC still remembers a past interaction.
 *
 * Uses `fsrs({ enable_fuzz: false })` for a deterministic scheduler, then calls
 * `scheduler.get_retrievability()` — the public surface that combines
 * `next_state` and `next_interval` projections into a single recall probability.
 * Returns `true` when that probability is at or above {@link RECALL_THRESHOLD}.
 *
 * Typical usage in an Edge Function prompt-builder:
 * ```ts
 * const activeMemories = npcMemories.filter(m =>
 *   calculateRetrievability(m.fsrs_state, m.elapsed_days)
 * );
 * ```
 *
 * @param memoryState  Persisted FSRS state for this NPC + interaction pair.
 * @param elapsedDays  Days elapsed since the memory was last reinforced.
 * @returns `true`  — the NPC still remembers; include in the LLM prompt.
 *          `false` — memory has decayed; omit from the LLM prompt.
 */
export function calculateRetrievability(
  memoryState: FSRSState,
  elapsedDays: number,
): boolean {
  return getRetrievabilityScore(memoryState, elapsedDays) >= RECALL_THRESHOLD;
}
