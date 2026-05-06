import Phaser from 'phaser';
import { EventBus } from '@/game/EventBus';

const SPEED = 200;
/** X coordinate of the right-side boundary that acts as the Level 1 exit gate. */
const LEVEL_1_EXIT_X = 750;

export class MainScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursors!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  /** Prevents firing the paywall event multiple times per pause. */
  private progressBlocked = false;
  private readonly _handlePause = () => this.handlePause();
  private readonly _handleResume = () => this.handleResume();

  constructor() {
    super({ key: 'MainScene' });
  }

  create() {
    // Placeholder player: a simple colored rectangle
    this.player = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      32,
      32,
      0x4ade80,
    );
    this.physics.add.existing(this.player);

    // WASD bindings
    const kb = this.input.keyboard!;
    this.cursors = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Listen for React → Phaser control commands
    EventBus.on('scene-pause', this._handlePause);
    EventBus.on('scene-resume', this._handleResume);

    EventBus.emit('current-scene-ready', this);
  }

  /**
   * Called by Phaser when the scene is shut down (e.g. on scene transition or
   * game destroy). Cleans up EventBus listeners to prevent memory leaks.
   */
  shutdown() {
    EventBus.off('scene-pause', this._handlePause);
    EventBus.off('scene-resume', this._handleResume);
  }

  private handlePause() {
    this.scene.pause();
  }

  private handleResume() {
    this.progressBlocked = false;
    this.scene.resume();
  }

  update() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    const left = this.cursors.left.isDown;
    const right = this.cursors.right.isDown;
    const up = this.cursors.up.isDown;
    const down = this.cursors.down.isDown;

    let vx = 0;
    let vy = 0;

    if (left) vx = -SPEED;
    else if (right) vx = SPEED;

    if (up) vy = -SPEED;
    else if (down) vy = SPEED;

    // Normalise diagonal movement
    if (vx !== 0 && vy !== 0) {
      const factor = Math.SQRT1_2;
      vx *= factor;
      vy *= factor;
    }

    body.setVelocity(vx, vy);

    // Level 1 exit gate: player approaching the right boundary triggers paywall check
    if (!this.progressBlocked && this.player.x >= LEVEL_1_EXIT_X) {
      this.progressBlocked = true;
      // Push player back so they can't walk through
      body.setVelocity(0, 0);
      this.player.x = LEVEL_1_EXIT_X - 20;
      EventBus.emit('level-progress-attempt');
    }

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      EventBus.emit('player-damaged', 10);
    }
  }
}
