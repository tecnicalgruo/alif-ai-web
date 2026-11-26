# ALIF AI Development Status

## Implemented

- Responsive dashboard, model-selecting chat, markdown output, copy, browser speech input and playback
- Gemini, xAI Grok, and OpenRouter server-side chat adapters
- GitHub OAuth sign-in foundation using JWT sessions
- Browser-local guest history and conversation restore
- Owner-scoped Prisma conversation create, update, list, and delete APIs
- Memory deletion controls for local and authenticated database history
- PostgreSQL connection status endpoint and Prisma singleton
- Tavily search route with validated input and explicit provider failures
- Plugin discovery endpoint and search UI
- PDF, TXT, and DOCX server-side text extraction
- Zod request validation, secure response headers, and calculator tool tests
- Vercel production deployment and GitHub `main` auto-deploy

## Requires owner configuration

- Model API keys and Tavily key in Vercel Environment Variables
- GitHub OAuth `GITHUB_ID` / `GITHUB_SECRET` and `AUTH_SECRET` to enable account sign-in
- PostgreSQL `DATABASE_URL` plus `prisma migrate deploy` before cloud history works

## Not complete

- Full autonomous LLM planner and multi-step tool loop
- Persistent plugin settings and per-user plugin enable/disable management
- Uploaded-file storage and linking extracted content to conversations
- Durable account preference controls
- Distributed rate limiting for public provider endpoints

## Next steps

1. Configure the required environment variables in Vercel without sharing keys in chat.
2. Create and configure the GitHub OAuth app callback URL.
3. Configure PostgreSQL and apply checked-in Prisma migrations.
4. Verify authenticated history, Tavily search, and provider calls against owner-provided credentials.
5. Add distributed rate limiting before broader public traffic.
