import { useEffect } from 'react';
import { useGameStore } from '@/shared';
import { EventBus } from '@/game';
import PhaserGame from '@/game/PhaserGame';
import { HUD } from '@/features/hud/HUD';

/**
 * App — root shell component.
 *
 * Architecture notes (FSD):
 *  - Feature-level UI lives in src/features/<feature>/ui/
 *  - Shared primitives live in src/shared/
 *  - Game ↔ React bridge uses EventBus only (no direct Phaser imports here)
 */
function App() {
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const setActiveScene = useGameStore((s) => s.setActiveScene);

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

  return (
    <main className="relative min-h-screen bg-gray-950 text-white">
      <HUD />
      <div className="absolute bottom-4 left-4 z-10 rounded bg-gray-800 px-4 py-2 text-xs text-green-400">
        {JSON.stringify({ phase }, null, 2)}
      </div>
      <PhaserGame />
    </main>
  );
}

export default App;
