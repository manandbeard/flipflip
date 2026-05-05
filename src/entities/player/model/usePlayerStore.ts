import { create } from 'zustand';

interface PlayerState {
  health: number;
}

interface PlayerActions {
  updateHealth: (damage: number) => void;
}

export const MAX_PLAYER_HEALTH = 100;

export const usePlayerStore = create<PlayerState & PlayerActions>((set) => ({
  health: MAX_PLAYER_HEALTH,
  updateHealth: (damage) =>
    set((state) => ({
      health: Math.max(0, state.health - Math.max(0, damage)),
    })),
}));
