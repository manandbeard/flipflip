# flipflip

An AI-driven, browser-based RPG built with procedural generation powered by Large Language Models.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 6, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Game Engine | Phaser 3 |
| State | Zustand (global), TanStack Query (async) |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions) |

## Architecture

This project uses **Feature-Sliced Design (FSD)**:

```
src/
├── entities/   # Domain models: Player, NPC, Item, Quest, …
├── features/   # User-facing capabilities: combat, dialogue, inventory, …
├── shared/     # Reusable primitives, Zustand store, utilities
└── game/       # Phaser 3 scenes + EventBus bridge
```

### React ↔ Phaser Bridge

React and Phaser **never share state directly**. All cross-boundary communication goes through the `EventBus` singleton (`src/game/EventBus.ts`):

- Phaser scenes call `EventBus.emit('event', payload)`
- React components subscribe in `useEffect` and push updates into Zustand

### AI / LLM Integration

All LLM calls are made through Supabase Edge Functions. Responses are validated against strict JSON Schemas before reaching the client — no raw prose.

### NPC Memory

NPC memory decay is implemented with [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs).

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
