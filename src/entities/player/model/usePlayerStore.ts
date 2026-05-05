import { create } from 'zustand';

interface PlayerState {
  health: number;
}

interface PlayerActions {
  /**
   * Applies incoming damage to health (clamped at 0).
   * Kept as `updateHealth` to match bridge contract requirements.
   */
  updateHealth: (damageAmount: number) => void;
}

export const MAX_PLAYER_HEALTH = 100;

export const usePlayerStore = create<PlayerState & PlayerActions>((set) => ({
  health: MAX_PLAYER_HEALTH,
  updateHealth: (damageAmount) =>
    set((state) => ({
      health: Math.max(0, state.health - Math.max(0, damageAmount)),
    })),
}));
