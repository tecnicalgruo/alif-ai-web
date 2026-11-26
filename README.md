# ALIF AI

ALIF AI is a responsive multi-model AI assistant built with Next.js App Router, React, TypeScript, Tailwind CSS, Prisma, and PostgreSQL.

## Features

- Dark responsive dashboard and Bengali/English chat UI
- Server-side Gemini, xAI Grok, and OpenRouter chat adapters
- Provider selection and server-sent event responses
- OpenRouter-first default with automatic failover to configured Gemini/Grok providers
- GitHub OAuth sign-in using Auth.js JWT sessions
- Browser-local chat history for guests
- Account-owned PostgreSQL conversation history for signed-in users
- Conversation deletion and memory controls
- Browser speech recognition and speech playback where supported
- Tavily web search API route and plugin discovery registry
- Server-side PDF, TXT, and DOCX text extraction (4 MB upload limit for Vercel compatibility)
- Bounded calculator tool, agent workspace, and explicit tool approval
- Zod request validation, API-key isolation, and security headers

## Local setup

Use Node.js 20.9 or later. Copy the environment template:

```powershell
Copy-Item .env.example .env.local
```

Configure at least one model provider:

- `GEMINI_API_KEY`: Google AI Studio API key
- `XAI_API_KEY`: xAI API key
- `OPENROUTER_API_KEY`: OpenRouter API key

Optional integrations:

- `WEB_SEARCH_API_KEY`: Tavily API key
- `DATABASE_URL`: PostgreSQL connection URL
- `GITHUB_ID` and `GITHUB_SECRET`: GitHub OAuth application credentials
- `AUTH_SECRET`: Auth.js session encryption secret
- `APP_URL`: application origin

Never use `NEXT_PUBLIC_` for secrets. Do not commit `.env.local`.

To enable GitHub sign-in, create a GitHub OAuth App and set its callback URL to:

```text
https://your-domain.example/api/auth/callback/github
```

For local development, use `http://localhost:3000/api/auth/callback/github`.
Without GitHub OAuth credentials, chat still works and history stays in the browser.

Install and run:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

## PostgreSQL and migrations

The UI and guest-local history work without a database. Account-synced history requires PostgreSQL, GitHub OAuth, and the initial Prisma migration:

```powershell
npx.cmd prisma generate
npx.cmd prisma migrate deploy
```

Run migrations manually against the configured database before deploying the app version that depends on a changed schema. The production build does not automatically alter a database.

## Vercel deployment

The GitHub `main` branch is connected to Vercel. Set required secrets under **Project → Settings → Environment Variables** for Production (and Preview if desired), then redeploy:

```text
GEMINI_API_KEY
XAI_API_KEY
OPENROUTER_API_KEY
WEB_SEARCH_API_KEY                 (optional; Tavily)
DATABASE_URL                       (optional; PostgreSQL)
AUTH_SECRET                        (required for persistent Auth.js sessions)
GITHUB_ID                          (optional; GitHub OAuth)
GITHUB_SECRET                      (optional; GitHub OAuth)
APP_URL=https://alif-ai-web.vercel.app
```

If GitHub OAuth is enabled, configure its callback to `https://alif-ai-web.vercel.app/api/auth/callback/github`. Never paste secrets into chat or source control. Add a database and run migrations before relying on cloud conversation history.

## Validation

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

## Current boundaries

- Provider keys must be added by the project owner in Vercel; configured keys are never sent to browsers.
- Tavily search is unavailable until `WEB_SEARCH_API_KEY` is set.
- Cloud chat history is unavailable until GitHub OAuth and PostgreSQL are configured and migrated; guests retain browser-local history.
- The agent currently runs bounded registered tools, not arbitrary plugin or uploaded code.
- Plugin catalog entries are discovery metadata; unimplemented providers are marked as requiring configuration.
- File text extraction is request-scoped and is not stored in PostgreSQL.
- In-memory rate limiting is per serverless instance; use a distributed rate-limit store before expecting consistent limits across Vercel instances.
- Vercel free-tier limits, provider quotas, and pricing can change; check current terms before production use.
