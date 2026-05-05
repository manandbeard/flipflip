import { forwardRef } from 'react';

/**
 * Ref handle exposed to parent components via forwardRef.
 *
 * `game`  — the running Phaser.Game instance (null before initialisation).
 * `scene` — the currently active Phaser Scene (null before the first scene starts).
 *
 * Typed as `object` until the `phaser` package is added as a dependency;
 * replace with `Phaser.Game` / `Phaser.Scene` at that point.
 */
export interface PhaserGameRef {
  game: object | null;
  scene: object | null;
}

/**
 * PhaserGame — React host for the Phaser canvas.
 *
 * Architecture notes (FSD / React-Phaser bridge):
 *  - This component owns the DOM node (#game-container) where Phaser mounts.
 *  - It exposes the Phaser Game instance and active Scene to parents via ref.
 *  - Communication between scenes and React flows exclusively through EventBus;
 *    no Phaser types are imported into any other React component.
 */
const PhaserGame = forwardRef<PhaserGameRef>(function PhaserGame(_props, ref) {
  // Phaser configuration and game initialisation will be wired here in a
  // future phase.  For now the component only provides the mount point and
  // the ref shape expected by parent components.
  void ref; // will be populated once Phaser is configured

  return <div id="game-container" />;
});

export default PhaserGame;
