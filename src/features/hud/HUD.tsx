import { useEffect } from 'react';
import { EventBus } from '@/game';
import {
  MAX_PLAYER_HEALTH,
  usePlayerStore,
} from '@/entities/player/model/usePlayerStore';

export function HUD() {
  const health = usePlayerStore((state) => state.health);
  const updateHealth = usePlayerStore((state) => state.updateHealth);

  useEffect(() => {
    const onPlayerDamaged = (damageAmount: unknown) => {
      const parsedDamageAmount = Number(damageAmount);
      if (!Number.isFinite(parsedDamageAmount)) {
        console.warn('Invalid player-damaged payload:', damageAmount);
        return;
      }
      updateHealth(parsedDamageAmount);
    };

    EventBus.on('player-damaged', onPlayerDamaged);

    return () => {
      EventBus.off('player-damaged', onPlayerDamaged);
    };
  }, [updateHealth]);

  const percent = Math.max(0, Math.min(100, (health / MAX_PLAYER_HEALTH) * 100));

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-10 w-64 rounded-md bg-black/60 p-3 text-white">
      <p className="mb-2 text-sm font-semibold">Health: {health}</p>
      <div className="h-4 w-full overflow-hidden rounded bg-red-950">
        <div
          className="h-full bg-red-500 transition-all duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
