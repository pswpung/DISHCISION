# DISHCISION — Agent Guide

Monorepo: `backend/` (Python FastAPI) + `frontend/` (Next.js 15, React 19, Tailwind CSS v4). LINE LIFF chatbot for group restaurant decision-making.

## Dev Commands

| What | How |
|---|---|
| Start all services | `./start-dev.sh` (tmux: docker db + frontend prod :3001 + backend uv :8081 + ngrok + cloudflared) |
| Stop all | `./stop-dev.sh` (kills tmux session) |
| Backend dev | `cd backend && uv run main.py` (auto-reload on :8081) |
| Frontend dev | `cd frontend && npm run dev` (:3000) |
| Frontend prod (tunnel) | `./start-prod-frontend.sh` (builds + serves on :3001) |
| Lint frontend | `cd frontend && npm run lint` |
| Database only | `cd deploy && docker compose up` (pgvector/pg16 :54321) |
| Full stack deploy | `cd deploy && docker compose --profile prod up` |

## Backend

- **Entry**: `backend/main.py` — starts uvicorn on :8081 with reload in dev
- **Package mgr**: `uv` (not pip/poetry). Deps in `pyproject.toml`, lock in `uv.lock`
- **Restaurant data**: CSV files in `backend/statics/` loaded at import time. Static file path is relative to cwd
- **Database**: PostgreSQL via pgvector image. URL from `DATABASE_URL` env (default `postgresql://postgres:P%40ssw0rd@localhost:54321/postgres`)
- **Models**: SQLAlchemy ORM, tables auto-created on startup via `Base.metadata.create_all`
- **Suggestion output** written to `./suggested_restaurants.json` at runtime
- **Timezone**: hardcoded `Asia/Bangkok`
- **Note**: `numpy<2` pinned in pyproject.toml

## Frontend

- **Entry**: `frontend/app/layout.tsx` (App Router root layout with LiffProvider + ThemeProvider)
- **API calls**: `app/services/api.ts` using `axios`. API base URL is empty string — Next.js rewrites proxy `/line/*`, `/users/*`, `/meetings/*`, `/attendee/*`, `/restaurant/*`, `/location/*` to `localhost:8081`
- **Env**: `frontend/.env.local` — needs `NEXT_PUBLIC_LIFF_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_AUTH_PROXY_URL`
- **CSS**: Tailwind v4 + vanilla CSS custom properties with light/dark theme via ThemeContext
- **Design system**: `frontend/design.md` defines the core design language. Use these utility classes instead of ad-hoc overrides:
  - `.glass-panel` — adaptive blurred glass cards (auto light/dark)
  - `.glass-input` — glass text inputs with primary focus ring
  - `.glass-button` — gradient primary action button with lift hover
  - HSL tokens in `globals.css`: light (coral/cream), dark (electric purple/cyan)
  - `font-geist-sans` primary, `font-geist-mono` secondary
- **Skill**: load `frontend-design` before building UI components. Load `webapp-testing` for E2E checks
- **Build quirks**: `eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: true` in `next.config.ts`
- **LIFF nuance**: Cache-Control header is `no-cache, must-revalidate` (not `no-store`) because `no-store` breaks LIFF webview on iOS/WKWebView redirect
- **Survey**: enable beta feedback survey by setting `NEXT_PUBLIC_ENABLE_BETA_SURVEY=true`

## LINE Bot

- **Webhook**: POST `/line/callback` — validates `X-Line-Signature` header
- **LINE SDK**: `@line/liff` on frontend, LINE Messaging API on backend
- **LIFF login**: `LiffContext.tsx` handles LIFF init, suppresses SDK internal load failure rejections

## Testing

- **Frontend E2E**: `cd frontend && npm run test:e2e` (Playwright, starts dev server automatically). Tests in `frontend/e2e/`
- Requires local install: `cd frontend && npx playwright install chromium`
- `backend/tests/` is empty. No backend test commands configured.

## OpenCode Environment

- **Plugin**: `opencode-ponytail` (lazy coding discipline) + `superpowers@git+https://github.com/obra/superpowers.git` (skill framework)
- **Memory**: agentmemory MCP at `http://localhost:3111`
- **Flow**: `.opencode/prompt.md` defines Plan → Review (Ponytail) → Implement → Document loop
- **graphify**: knowledge graph in `graphify-out/`. Trigger: `/graphify`
- **RTK**: Rust Token Killer CLI (`rtk`) — token-optimized proxy for dev commands (60-90% savings). Referenced via `~/.claude/RTK.md` in `opencode.json` instructions
- **CHANGELOG.md**: manual entries, no automation
