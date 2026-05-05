/**
 * EventBus — the single communication channel between Phaser and React.
 *
 * Phaser scenes emit events via EventBus.emit(…).
 * React components subscribe in useEffect(() => { EventBus.on(…) }).
 * Zustand store updates are triggered from those React listeners.
 *
 * NEVER import Phaser objects into React, and NEVER import React/Zustand into Phaser.
 */

type EventCallback = (...args: unknown[]) => void;

class EventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return this;
  }

  once(event: string, callback: EventCallback): this {
    const wrapper: EventCallback = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  off(event: string, callback: EventCallback): this {
    this.listeners.get(event)?.delete(callback);
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
    return this;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
}

export const EventBus = new EventEmitter();
