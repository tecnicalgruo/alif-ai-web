# ALIF AI

ALIF AI is a responsive multi-model AI assistant built with Next.js App Router, React, TypeScript, Tailwind CSS, Prisma, and PostgreSQL.

## Features

- Dark responsive dashboard and Bengali/English chat UI
- Mobile-friendly navigation and chat controls with horizontally scrollable, color-styled code blocks
- Server-side Gemini, xAI Grok, and OpenRouter chat adapters
- Provider selection and server-sent event responses
- OpenRouter-first default with automatic failover to configured Gemini/Grok providers
- GitHub OAuth sign-in using Auth.js JWT sessions
- Browser-local chat history for guests
- Account-owned PostgreSQL conversation history for signed-in users
- Per-account default provider, response language, and speech preferences
- Persistent per-account plugin settings, with browser-local guest settings
- Conversation deletion and memory controls
- Browser speech recognition and speech playback where supported
- Tavily web search API route and plugin discovery registry
- Server-side PDF, TXT, and DOCX text extraction (4 MB upload limit); extracted text can be saved and linked to a conversation
- Bounded multi-step AI agent with validated JSON planning, explicit per-tool approval, calculator, web search, text summarization, and optional GitHub/Supabase/Gmail connectors
- PostgreSQL-backed distributed rate limits when a database is configured
- Zod request validation, API-key isolation, and security headers

## Local setup

Use Node.js 20.9 or later. Copy the environment template:

```powershell
Copy-Item .env.example .env.local
```

Configure at least one model provider for chat:

- `GEMINI_API_KEY`: Google AI Studio API key
- `XAI_API_KEY`: xAI API key
- `OPENROUTER_API_KEY`: OpenRouter API key

Optional integrations:

- `WEB_SEARCH_API_KEY`: Tavily API key
- `DATABASE_URL`: PostgreSQL connection URL
- `GITHUB_ID` and `GITHUB_SECRET`: GitHub OAuth application credentials
- `AUTH_SECRET`: Auth.js session encryption secret
- `APP_URL`: application origin
- `INTEGRATION_ENCRYPTION_KEY`: at least 32 characters; encrypts per-user external connector credentials (`AUTH_SECRET` is a fallback)
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Google OAuth credentials for Gmail

Never use `NEXT_PUBLIC_` for secrets. Do not commit `.env.local`.

To enable GitHub sign-in, create a GitHub OAuth App and set its callback URL to:

```text
https://your-domain.example/api/auth/callback/github
```

For local development, use `http://localhost:3000/api/auth/callback/github`.
The agent planner requires `OPENROUTER_API_KEY` or `XAI_API_KEY`; web search additionally requires `WEB_SEARCH_API_KEY`. Without GitHub OAuth credentials, chat still works and history/preferences remain in the browser.

Install and run:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

## PostgreSQL and migrations

The UI and guest-local history work without a database. Account-synced history, preferences, plugin settings, saved extracted text, and shared rate limits require PostgreSQL, GitHub OAuth, and all checked-in Prisma migrations:

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
INTEGRATION_ENCRYPTION_KEY            (recommended; stable random secret, 32+ characters; falls back to AUTH_SECRET)
GOOGLE_CLIENT_ID                      (required for Gmail OAuth)
GOOGLE_CLIENT_SECRET                  (required for Gmail OAuth)
```

If GitHub sign-in is enabled, configure its callback to `https://alif-ai-web.vercel.app/api/auth/callback/github`. For Gmail, configure `https://alif-ai-web.vercel.app/api/integrations/gmail/callback` in the Google OAuth client. Never paste secrets into chat or source control. Run migrations before enabling `DATABASE_URL` in Production; database-backed routes return an explicit service error until migrations are applied.

## External tool connections

GitHub, Supabase, and Gmail are available from **Plugins** after sign-in and database setup. Connector credentials are encrypted per user on the server and are never returned by the integrations status API. Set `INTEGRATION_ENCRYPTION_KEY` to a stable, random value of at least 32 characters in every deployment environment; changing it makes previously stored connector credentials unreadable. `AUTH_SECRET` is used only when the dedicated key is not set.

- **GitHub:** connect a fine-grained personal access token in Plugins. The agent can list authorized repositories and search issues. Creating an issue is a write operation: explicitly enable the GitHub plugin, select the create-issue tool, and state the exact repository, title, and body in the task. Pull request creation and deletion are not enabled.
- **Supabase:** connect an HTTPS project URL, a publishable/anon key, and a table allowlist. Service-role/secret keys are rejected. The agent can read up to 20 rows per request and can insert or update rows only when the matching write tools are explicitly enabled and approved for a task. Updates require equality filters and are capped at one affected row per request. Row Level Security remains the authorization boundary; arbitrary SQL, schema changes, and delete tools are not available.
- **Gmail:** configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then register `https://your-domain.example/api/integrations/gmail/callback` as an authorized Google OAuth redirect URI. The requested scopes are `gmail.readonly` and `gmail.send`; access and refresh tokens stay encrypted on the server. Search and read are available after explicit tool approval. Sending requires the Gmail write tool and exact recipient, subject, and body in the task. Gmail labels and deletion are not enabled.
- **Remote Desktop Commander:** not connected because the exact vendor/product and supported API have not been identified. Desktop control remains unavailable.

For any external write, enable the connector under Plugins and select its specific write tool in the Agent workspace. Include the exact target and intended change in the objective; the agent is instructed not to invent missing details. Disconnecting removes the locally stored credential and does not delete data from the external provider. Never paste access tokens, API keys, email contents, or private repository data into chat. Gmail OAuth consent-screen verification may be required before public use.

## Validation

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

## Current boundaries

- Provider keys must be added by the project owner in Vercel; configured keys are never sent to browsers.
- Tavily search is unavailable until `WEB_SEARCH_API_KEY` is set. The agent only searches the web when the user explicitly approves that tool for the task.
- Account-synced history, preferences, plugin settings, saved extracted text, external integrations, and shared rate limits require sign-in, PostgreSQL, and applied migrations. Guests keep history/preferences/plugins in their browser; guest uploads are temporary.
- The agent can only call its bounded registered tools. It never executes arbitrary plugin or uploaded code; catalog entries without implementations remain informational.
- Uploaded binaries are not retained. For signed-in users with PostgreSQL, extracted text (up to 100,000 characters) and metadata are stored and may be linked to a conversation.
- Without PostgreSQL, or before the `ApiRateLimit` table migration is applied, rate limiting uses per-instance memory and is not globally consistent across Vercel instances. The temporary migration fallback is logged and marked in response headers/SSE notices.
- Vercel free-tier limits, provider quotas, and pricing can change; check current terms before production use.
