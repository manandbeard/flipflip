Project Overview
You are building an AI-driven, browser-based RPG. The application relies on procedural generation driven by Large Language Models (LLMs) and a structured game engine environment.
Tech Stack & Rules
Frontend: React 18, Vite 6, Tailwind CSS, shadcn/ui.
Game Engine: Phaser 3.
State Management: Zustand (global persistent state) and TanStack Query (async data).
Backend: Supabase (PostgreSQL, Auth, Edge Functions).
Architectural Constraints (CRITICAL)
Feature-Sliced Design (FSD): You must strictly organize code into src/entities, src/features, src/shared, and src/game. Do not use a flat component structure.
The React/Phaser Bridge: React and Phaser must never share state directly. You must use an EventBus.js (Pub/Sub) pattern. Phaser emits events, and React listens via useEffect to trigger Zustand updates.
Structured AI Outputs: All LLM integrations (via Edge Functions) must enforce strict JSON Schemas. Never output raw prose to the client.
NPC Memory: We use ts-fsrs to handle memory decay.
Copilot Operating Guidelines
Always tell the user your plan before generating large chunks of code.
Ask clarifying questions if a prompt is vague.
Include expected outputs or acceptance criteria so you can verify your own work.
Decompose complex tasks into smaller, well-scoped steps.
