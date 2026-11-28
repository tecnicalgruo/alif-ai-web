# ALIF AI Development Status

## Integration connector implementation — 2026-11-28

Connector implementation resumed after the user requested continuation. The implementation was committed and pushed to `main` as `f59f049`; Vercel reports the Production deployment as Ready.

### Changes currently in the worktree

Connector implementation lives in `README.md`, `src/app/agent/page.tsx`, `src/app/api/agent/route.ts`, `src/app/api/plugins/route.ts`, `src/app/plugins/page.tsx`, `src/lib/validation.ts`, `src/app/api/integrations/`, and `src/lib/integrations/`.

Implemented locally:

- Per-user AES-GCM credential storage using `INTEGRATION_ENCRYPTION_KEY` (or `AUTH_SECRET` as a fallback).
- Authenticated GitHub PAT and Supabase project connection/disconnection endpoints; credentials are not returned from the status endpoint.
- Gmail OAuth connect/callback, limited Gmail read/send scopes, access-token refresh, and search/read/send helpers.
- Agent tools for GitHub repository/issue lookup and issue creation, allowlisted Supabase row reads/inserts/updates, and Gmail search/read/send. No delete or arbitrary SQL tools.
- Plugin marketplace connection forms and per-tool Agent approvals. External integrations require sign-in, a database, and enabling the matching plugin. External results are excluded from saved agent logs.
- Focused credential-encryption tests.
- Gmail OAuth state is bound to the initiating signed-in account; an existing refresh token is preserved if Google omits a replacement on reconnect.
- Supabase updates require equality filters and cap each request to one affected row.
- Agent's reported tool registry includes the three providers' bounded tool actions.

Remote Desktop Commander remains disconnected because its exact product/vendor/API is still unidentified. No provider credentials are configured or live integrations tested in this work.

### Validation

- `git diff --check` passed.
- `npm.cmd test` passed: 20 tests across 6 files.
- `npm.cmd run lint` passed.
- `npx.cmd tsc --noEmit` passed.
- `npm.cmd run build` passed; the build includes `/api/integrations`, `/api/integrations/gmail/connect`, and `/api/integrations/gmail/callback`.
- No live provider connection or OAuth flow was tested because no provider credentials are configured.
- The production status route returned HTTP 200; `/plugins` returned HTTP 200 with the new external-connections UI; unauthenticated `/api/integrations` correctly returned HTTP 401.
- The latest Vercel Production build includes the integrations and Gmail OAuth routes and is Ready.
- Vercel Production has `DATABASE_URL`, `AUTH_SECRET`, GitHub sign-in credentials, and AI provider variables. `INTEGRATION_ENCRYPTION_KEY` is absent, so the existing `AUTH_SECRET` fallback is used. Gmail is not ready for OAuth: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are not configured.

### Remaining

1. The owner must configure PostgreSQL/migrations, `AUTH_SECRET`, stable `INTEGRATION_ENCRYPTION_KEY`, and Gmail `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` before live use. Set the Gmail OAuth redirect URI to `https://alif-ai-web.vercel.app/api/integrations/gmail/callback`.
2. Only perform live provider tests after the owner has configured credentials. Never request or record secrets in chat.
3. Keep provider credentials out of source control and chat. Live Gmail use still requires the owner to configure Google OAuth credentials in Vercel and connect an account from Plugins. GitHub PAT and Supabase project credentials are connected per user in Plugins.

## Implemented

- Responsive dashboard, model-selecting chat, markdown output, copy, browser speech input and playback
- Mobile navigation and compact chat controls; fenced code renders in labeled, copyable, horizontally scrollable color panels
- Gemini, xAI Grok, and OpenRouter server-side chat adapters
- Token streaming and OpenRouter-first provider failover for faster chat
- GitHub OAuth sign-in foundation using JWT sessions
- Browser-local guest history and conversation restore
- Owner-scoped Prisma conversation create, update, list, and delete APIs
- Account preferences for default provider, response language, and speech playback; browser-local guest fallback
- Persistent per-account plugin enable/disable preferences, with browser-local guest fallback
- Bounded LLM planner and multi-step validated JSON-plan tool loop using OpenRouter/xAI-compatible chat completions
- User-approved calculator, optional Tavily web search, and supplied-text summarizer tools
- Saved extracted document text, owner-scoped file operations, and conversation linking
- PostgreSQL-backed shared rate-limit buckets, with a logged, response-marked per-instance fallback until the new migration is applied
- Memory deletion controls for local and authenticated database history
- PostgreSQL connection status endpoint and Prisma singleton
- Tavily search route with validated input and explicit provider failures
- Plugin discovery endpoint and search UI
- PDF, TXT, and DOCX server-side text extraction
- Zod request validation, secure response headers, and calculator tool tests
- Vercel production deployment and GitHub `main` auto-deploy

## Owner setup required for cloud features

- Set valid provider secrets, `GITHUB_ID`, `GITHUB_SECRET`, `AUTH_SECRET`, `DATABASE_URL`, and `APP_URL` in Vercel; never share secrets in chat or commit them.
- Set the GitHub OAuth callback to `https://alif-ai-web.vercel.app/api/auth/callback/github`.
- Apply all checked-in migrations with `npx.cmd prisma migrate deploy` before enabling `DATABASE_URL` in Production.
- Set `WEB_SEARCH_API_KEY` to enable Tavily. The agent only uses external search after the user approves it for that run.
- Without the database, guest history/preferences/plugin settings remain browser-local, uploads are temporary, and rate limits are per-instance rather than distributed.
