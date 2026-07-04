# DISHCISION — Agent Guide

Monorepo: `backend/` (Python FastAPI) + `frontend/` (Next.js 15, React 19, Tailwind CSS v4). LINE LIFF chatbot for group restaurant decision-making.

## Dev Commands

| What | How |
|------|-----|
| Start all services | `./start-dev.sh` (tmux: docker db + frontend prod :3001 + backend uv :8081 + ngrok + cloudflared) |
| Stop all | `./stop-dev.sh` |
| Backend dev | `cd backend && uv run main.py` (auto-reload on :8081) |
| Frontend dev | `cd frontend && npm run dev` (:3000) |
| Frontend prod (tunnel) | `./start-prod-frontend.sh` (:3001) |
| Lint frontend | `cd frontend && npm run lint` |
| Database only | `cd deploy && docker compose up` (pgvector/pg16 :54321) |
| Full stack deploy | `cd deploy && docker compose --profile prod up` |

## Backend

- **Entry**: `backend/main.py` — uvicorn on :8081, reload in dev
- **Package mgr**: `uv` (not pip/poetry). Deps in `pyproject.toml`, lock in `uv.lock`
- **Restaurant data**: CSV in `backend/statics/`, loaded at import (path relative to cwd)
- **Database**: pgvector/pg16. URL from `DATABASE_URL` env (default `postgresql://postgres:P%40ssw0rd@localhost:54321/postgres`)
- **Models**: SQLAlchemy ORM, auto-created on startup via `Base.metadata.create_all`
- **Timezone**: hardcoded `Asia/Bangkok`
- **Pin**: `numpy<2` in pyproject.toml
- **Flex message design**: `backend/flex-design.md` — color palette, header/body/button patterns. All new Flex messages must follow this.
- **Scoring filter**: `restaurant_suggestion.py` queries `is_joined == True` only — declined attendees are excluded from all time slot and restaurant scoring.

## Frontend

- **Entry**: `app/layout.tsx` (LiffProvider + ThemeProvider)
- **API**: `app/services/api.ts` via axios. Empty base URL — Next.js rewrites proxy `/line/*`, `/users/*`, `/meetings/*`, `/attendee/*`, `/restaurant/*`, `/location/*` to `localhost:8081`
- **Env**: `.env.local` — needs `NEXT_PUBLIC_LIFF_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_AUTH_PROXY_URL`
- **CSS**: Tailwind v4, light/dark theme via ThemeContext. Design tokens in `design.md`.
- **Build quirks**: `eslint.ignoreDuringBuilds: true`, `typescript.ignoreBuildErrors: true` in `next.config.ts`. SWC parser rejects nested template literals in JSX className — use `str + '_' + str` instead of `` `${str}_${str}` `` inside outer backticks. SWC also fails on JSX between ternary branches — wrap with `<>...</>` fragments.
- **LIFF nuance**: Cache-Control is `no-cache, must-revalidate` (not `no-store`) — `no-store` breaks LIFF webview on iOS/WKWebView redirect
- **Survey**: set `NEXT_PUBLIC_ENABLE_BETA_SURVEY=true` to enable feedback survey

## LINE Bot

- **Webhook**: POST `/line/callback` — validates `X-Line-Signature` header
- **Frontend SDK**: `@line/liff`; Backend: LINE Messaging API
- **LIFF login**: `LiffContext.tsx` handles init, suppresses SDK load failure rejections
- **Commands**: `#create-meeting` / `#สร้างนัด` — sends Create Meeting button. `#register` — links LINE profile to DB. `#help` — shows command list. Unknown commands silently ignored.
- **Flex Messages**: Four types:
  - `push_message_creation_flex` — sent when a meeting is created, with "Add Preferences" button
  - `push_message_result_flex` — sent when ALL attendees submit availability; header auto-adapts: "Suggestions Ready" / "Time Finalized" / "Restaurant Fixed" / "Finalized Meeting". Button: "See Suggestions & Vote" → `/result`
  - `push_message_decision_summary_flex` — sent when ALL joined attendees submit votes on `/result`. "All Votes Collected! @organizer_name all votes are in!" Button: "Review & Decide" → `/decision`
  - `push_message_all_declined_flex` — sent when every attendee declined. No action buttons.

## Page & API Structure

| Route | File | Purpose | Access |
|-------|------|---------|--------|
| `/create-meeting` | `create-meeting/page.tsx` | 3-step create form | Organizer |
| `/availability` | `availability/page.tsx` | RSVP + availability + preferences | Attendees |
| `/vote` | `vote/page.tsx` | Legacy redirect → `/availability` | — |
| `/result` | `result/page.tsx` | Vote on time slots + restaurants | Everyone |
| `/decision` | `decision/page.tsx` | Final confirmation + spin wheel | Organizer (edit), Others (view) |
| `/[id]/feedback` | `feedback/page.tsx` | Beta survey | Everyone |

| Backend endpoint | Purpose |
|-----------------|---------|
| `PATCH /attendee/{meetingId}/{userId}` | Submit RSVP + availability + preferences |
| `POST /restaurant/suggest/{meetingId}` | Generate suggestions |
| `POST /meetings/{id}/submit-votes` | Batch submit time slot + restaurant votes |
| `POST /meetings/{id}/toggle-ready` | Mark user as done voting on `/result` |
| `POST /meetings/{id}/confirm-final` | Organizer locks final time + restaurant |
| `POST /meetings/{id}/spin-wheel` | Save spin wheel result |
| `POST /meetings/{id}/set-decision-method` | Toggle pick vs wheel mode |

## Flow

1. **Create meeting** — Organizer fills 3 steps (details → availability → preferences). Submits → meeting created + organizer's vote saved. Survey mode: preview only, no submit.
2. **Attendees vote** — Each attendee (not organizer) goes to `/availability`, submits RSVP + availability + preferences. When ALL attendees have `preference is not None` (including declined — `{}` counts as submitted), auto-triggers suggestions. If zero attendees joined, sends `push_message_all_declined_flex` instead.
3. **Suggestions ready** — Backend sends `push_message_result_flex` to LINE ("Suggestions Ready, Let's Vote.") → button links to `/result`.
4. **Vote on result** — `/result` page: toggle "Prefer this time" per slot, prefer/veto restaurants, then "Submit My Votes" (glass-button, batch save). After submit: "Waiting for others..."
5. **All voted** — When ALL joined attendees submit votes → backend sends `push_message_decision_summary_flex` ("All Votes Collected! @organizer") → button links to `/decision`.
6. **Organizer decides** — `/decision` page: pick time (tap list or spin wheel) + pick restaurant (tap list or spin wheel) → "Confirm & Notify Group". Others see read-only state + wheel animation.
7. **Finalized** — Backend sends `push_message_result_flex` with header "📍 Finalized Meeting" showing confirmed time, restaurant, attendees.

## Testing

- `cd frontend && npm run test:e2e` (Playwright, starts dev server). Tests in `frontend/e2e/`
- Requires: `cd frontend && npx playwright install chromium`
- `backend/tests/` is empty — no backend test commands.

## Graphify

- `graphify` needs an API key for semantic extraction (docs/papers/images). Set one of: `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`. Without one, only code AST extraction runs.
