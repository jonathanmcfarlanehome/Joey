Vision

Build an AI‑first software factory that plans, codes, tests, and ships product increments in Agile sprints with minimal human input. Humans get: (1) an executive dashboard (burn‑down, velocity, risks), (2) clickable demos at the end of each sprint, (3) audit trails of decisions, (4) acceptance toggles.

Core Architecture

Event‑driven multi‑agent system with a shared project graph. Agents communicate via a typed message bus and update a single source of truth (Crowley, your AI‑Jira). Orchestrator enforces gates.
