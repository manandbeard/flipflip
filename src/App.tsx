import { useEffect } from 'react';
import { useGameStore } from '@/shared';
import { EventBus } from '@/game';

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white">
      <h1 className="text-4xl font-bold tracking-tight">flipflip</h1>
      <p className="mt-2 text-sm text-gray-400">
        Phase 1 — Foundation scaffold ✓
      </p>
      <pre className="mt-6 rounded bg-gray-800 px-6 py-4 text-xs text-green-400">
        {JSON.stringify({ phase }, null, 2)}
      </pre>
    </main>
  );
}

export default App;
