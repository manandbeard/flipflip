import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGameStore } from '@/shared';
import { EventBus } from '@/game';
import PhaserGame from '@/game/PhaserGame';
import { HUD } from '@/features/hud/HUD';
import { PaywallModal } from '@/features/paywall/PaywallModal';
import { usePermissionFlag } from '@/shared/hooks/usePermissionFlag';

const queryClient = new QueryClient();

/**
 * App — root shell component.
 *
 * Architecture notes (FSD):
 *  - Feature-level UI lives in src/features/<feature>/ui/
 *  - Shared primitives live in src/shared/
 *  - Game ↔ React bridge uses EventBus only (no direct Phaser imports here)
 */
function AppInner() {
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const setActiveScene = useGameStore((s) => s.setActiveScene);
  const openPaywall = useGameStore((s) => s.openPaywall);

  const { isPermitted } = usePermissionFlag();

  // Example: listen for Phaser "scene-ready" events and push them into Zustand.
  useEffect(() => {
    const onSceneReady = (sceneKey: unknown) => {
      setActiveScene(String(sceneKey));
      setPhase('playing');
    };

    EventBus.on('scene-ready', onSceneReady);
    return () => {
      EventBus.off('scene-ready', onSceneReady);
    };
  }, [setPhase, setActiveScene]);

  // Intercept level-progress-attempt from Phaser: gate on subscription flag.
  useEffect(() => {
    const onProgressAttempt = () => {
      if (!isPermitted) {
        setPhase('paused');
        openPaywall();
        EventBus.emit('scene-pause');
      }
    };

    EventBus.on('level-progress-attempt', onProgressAttempt);
    return () => {
      EventBus.off('level-progress-attempt', onProgressAttempt);
    };
  }, [isPermitted, setPhase, openPaywall]);

  return (
    <main className="relative min-h-screen bg-gray-950 text-white">
      <HUD />
      <div className="absolute bottom-4 left-4 z-10 rounded bg-gray-800 px-4 py-2 text-xs text-green-400">
        {JSON.stringify({ phase }, null, 2)}
      </div>
      <PhaserGame />
      <PaywallModal />
    </main>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}

export default App;
