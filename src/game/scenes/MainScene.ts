import Phaser from 'phaser';
import { EventBus } from '@/game/EventBus';

const SPEED = 200;

export class MainScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private cursors!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

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

    EventBus.emit('current-scene-ready', this);
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
  }
}
