# ALIF AI Development Status

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
