import Phaser from 'phaser';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EventBus } from './EventBus';
import { gameConfig } from './main';

/**
 * Ref handle exposed to parent components via forwardRef.
 *
 * `game`  — the running Phaser.Game instance (null before initialisation).
 * `scene` — the currently active Phaser Scene (null before the first scene starts).
 */
export interface PhaserGameRef {
  game: Phaser.Game | null;
  scene: Phaser.Scene | null;
}

/** Props for PhaserGame (currently none; reserved for future configuration). */
export type PhaserGameProps = Record<string, never>;

/**
 * PhaserGame — React host for the Phaser canvas.
 *
 * Architecture notes (FSD / React-Phaser bridge):
 *  - This component owns the DOM node (#game-container) where Phaser mounts.
 *  - It exposes the Phaser Game instance and active Scene to parents via ref.
 *  - Communication between scenes and React flows exclusively through EventBus;
 *    no Phaser types are imported into any other React component.
 */
const PhaserGame = forwardRef<PhaserGameRef, PhaserGameProps>(function PhaserGame(
  _props,
  ref,
) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<Phaser.Scene | null>(null);

  useImperativeHandle(ref, () => ({
    get game() {
      return gameRef.current;
    },
    get scene() {
      return sceneRef.current;
    },
  }));

  useEffect(() => {
    // Boot exactly once
    if (gameRef.current) return;

    gameRef.current = new Phaser.Game({
      ...gameConfig,
      parent: 'game-container',
    });

    const onSceneReady = (scene: unknown) => {
      sceneRef.current = scene as Phaser.Scene;
    };

    EventBus.on('current-scene-ready', onSceneReady);

    return () => {
      EventBus.off('current-scene-ready', onSceneReady);
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  return <div id="game-container" />;
});

export default PhaserGame;
