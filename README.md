# ALIF AI

ALIF AI is a responsive multi-model AI web agent built with Next.js, React and TypeScript.

## Implemented

- Premium dark dashboard and responsive AI chat interface
- Gemini, xAI Grok and OpenRouter server-side provider adapters
- Unified provider status and model selection
- Streaming chat through Server-Sent Events
- Assistant and bounded autonomous-agent interfaces
- Registered tool registry and explicit calculator approval
- Plugin, file and settings screens
- Zod request validation
- Prisma PostgreSQL schema
- Secure response headers
- Unit tests for validation and safe tool execution
- GitHub OAuth sign-in foundation
- Prisma-backed conversation routes when DATABASE_URL is configured
- Local chat history and memory controls
- Tavily live web search route

## Configure

Copy `.env.example` to `.env.local` and add the desired provider key:

```powershell
Copy-Item .env.example .env.local
```

- `GEMINI_API_KEY`: Google AI Studio API key
- `XAI_API_KEY`: xAI API key
- `OPENROUTER_API_KEY`: OpenRouter API key
- `WEB_SEARCH_API_KEY`: reserved for a configured search provider
- `DATABASE_URL`: PostgreSQL connection URL
- `AUTH_SECRET`: secret used for future authenticated deployment
- `APP_URL`: public application URL

Private keys must never use `NEXT_PUBLIC_`.

## Database

PostgreSQL is optional for local UI development. When configured:

```powershell
$env:PATH='C:\Program Files\nodejs;'+$env:PATH
npx.cmd prisma generate
npx.cmd prisma migrate dev --name init
```

Use a PostgreSQL provider such as Neon or Supabase. Configure `DATABASE_URL` in Vercel environment settings.

## Run

```powershell
$env:PATH='C:\Program Files\nodejs;'+$env:PATH
npm.cmd run dev
```

Open `http://localhost:3000`.

## Test and build

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

## Deployment

The application is deployable to Vercel. Add provider, database and auth secrets in Vercel project settings. Database migrations and authentication must be completed before public multi-user deployment.

## Remaining integrations

- Brave or Tavily live search provider
- Server-side PDF, TXT and DOCX extraction
- Persistent Prisma-backed chat history
- Authentication and multi-user isolation
- Full browser and plugin execution workflows
- Voice browser controls
