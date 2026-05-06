/**
 * Global game store (Zustand).
 *
 * This is the single source of truth for all persistent UI state.
 * Phaser NEVER imports this file directly — it communicates through EventBus.
 * React components subscribe here and update via EventBus listeners.
 */

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GamePhase = 'idle' | 'loading' | 'playing' | 'paused' | 'ended';

export interface GameState {
  /** Current high-level phase of the game loop. */
  phase: GamePhase;
  /** Player's display name (set after auth). */
  playerName: string | null;
  /** Active scene key reported by Phaser. */
  activeScene: string | null;
  /** Whether the paywall modal is currently open. */
  isPaywallOpen: boolean;
}

export interface GameActions {
  setPhase: (phase: GamePhase) => void;
  setPlayerName: (name: string) => void;
  setActiveScene: (scene: string) => void;
  openPaywall: () => void;
  closePaywall: () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: GameState = {
  phase: 'idle',
  playerName: null,
  activeScene: null,
  isPaywallOpen: false,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGameStore = create<GameState & GameActions>((set) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),
  setPlayerName: (name) => set({ playerName: name }),
  setActiveScene: (scene) => set({ activeScene: scene }),
  openPaywall: () => set({ isPaywallOpen: true }),
  closePaywall: () => set({ isPaywallOpen: false }),
  reset: () => set(initialState),
}));
