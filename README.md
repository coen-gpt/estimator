# CoenGPT Jobber Integration (Next.js + Prisma + Vercel)

Production-ready starter repository for integrating Jobber OAuth, webhook ingestion, and AI-agent-facing quote draft APIs.

## Stack
- Next.js (App Router, TypeScript)
- Prisma ORM + Postgres
- Server-side OAuth + token refresh
- Webhook signature verification (HMAC SHA256)
- Vercel deployment target

## Folder tree
```text
.
├── .env.example
├── .gitignore
├── README.md
├── eslint.config.mjs
├── next.config.ts
├── next-env.d.ts
├── package.json
├── postcss.config.mjs
├── prisma
│   └── schema.prisma
├── src
│   ├── app
│   │   ├── api
│   │   │   ├── agent
│   │   │   │   └── quote
│   │   │   │       └── draft
│   │   │   │           └── route.ts
│   │   │   ├── connections
│   │   │   │   └── [id]
│   │   │   │       ├── disconnect
│   │   │   │       │   └── route.ts
│   │   │   │       └── refresh
│   │   │   │           └── route.ts
│   │   │   ├── health
│   │   │   │   └── route.ts
│   │   │   └── jobber
│   │   │       └── test
│   │   │           └── route.ts
│   │   ├── connections
│   │   │   ├── [id]
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   ├── jobber
│   │   │   ├── callback
│   │   │   │   └── route.ts
│   │   │   └── connect
│   │   │       └── route.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── webhooks
│   │       └── jobber
│   │           └── route.ts
│   └── lib
│       ├── crypto.ts
│       ├── env.ts
│       ├── jobber.ts
│       ├── oauth-state.ts
│       ├── prisma.ts
│       ├── token.ts
│       └── webhook.ts
└── tsconfig.json
```

## Environment Variables
Copy `.env.example` to `.env` and fill values:

```bash
cp .env.example .env
```

Required values:
- `DATABASE_URL` Postgres connection string
- `JOBBER_CLIENT_ID`
- `JOBBER_CLIENT_SECRET`
- `JOBBER_REDIRECT_URI` (must exactly match callback URL in Jobber app settings)
- `OAUTH_STATE_SECRET` (long random secret used for signed OAuth state)
- `APP_BASE_URL` (`https://app.coenconstruction.com` in production)
- `OPENAI_API_KEY` (server-side key for estimator AI responses)
- `OPENAI_MODEL` (optional, defaults to `gpt-4.1-mini`)

## Prisma setup
1. Install dependencies:
```bash
npm install
```

2. Generate Prisma client:
```bash
npm run prisma:generate
```

3. Create and run migration locally:
```bash
npx prisma migrate dev --name init
```

4. In production (Vercel), run:
```bash
npm run prisma:migrate
```

## Local development
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).


## Test the Residential Estimator Designer
Use this flow to validate the new customer-facing AI estimator/designer widget end-to-end.

1. Install dependencies and run the app:
```bash
npm install
npm run dev
```
2. Open `http://localhost:3000`.
3. Click **Open AI Project Designer** (bottom-right floating button).
4. Fill in:
   - Project details (required)
   - Timeline/address (optional)
   - 1+ reference photos (strongly recommended so rendering is based on the actual house/project condition)
5. Click **Create concept + rough estimate**.
6. Verify results:
   - Assistant guidance message
   - Concept rendering image
   - Rough estimate range + line-item split
   - Non-binding disclaimer requiring on-site human estimator

### API-only test (no browser)
You can also test the estimator endpoint directly:

```bash
curl -X POST http://localhost:3000/api/agent/residential/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {"role": "user", "content": "We want a 400 sq ft kitchen remodel with quartz counters and custom cabinets."}
    ],
    "timeline": "3 months",
    "projectAddress": "123 Main St",
    "photos": [
      {"name": "kitchen1.jpg", "size": 120034, "type": "image/jpeg"}
    ]
  }'
```

Expected response includes `assistantMessage`, `roughEstimate`, and `rendering.imageUrl`.

Estimator AI note:
- The widget AI logic uses the server route with `OPENAI_API_KEY` from environment variables.
- Do **not** hardcode API keys in source files; keep them only in `.env` / deployment secrets.


If no photos are uploaded, you can set `GOOGLE_MAPS_API_KEY` and provide a project address so the app can use Google Street View as an address-based fallback rendering source.

## Implemented endpoints

### OAuth
- `GET /jobber/connect`
  - Creates signed state token (10-min expiry)
  - Redirects to `https://api.getjobber.com/api/oauth/authorize`
- `GET /jobber/callback`
  - Verifies state
  - Exchanges auth code at `https://api.getjobber.com/api/oauth/token`
  - Stores connection + tokens in Postgres
  - Redirects to `/connections`

### Webhooks
- `POST /webhooks/jobber`
  - Reads raw body bytes
  - Verifies `X-Jobber-Hmac-SHA256` using HMAC SHA256 + base64 digest
  - Uses timing-safe compare
  - Dedupes with `externalId` and `payloadHash`
  - Writes to `WebhookEvent` and `Job` queue table, returns quickly

### Admin / UI
- `/` landing page with Connect button
- `/connections` list with Test GraphQL + Disconnect
- `/connections/[id]` detail with refresh token button and webhook event history

### Agent endpoints
- `POST /api/agent/quote/draft`
  - Input:
  ```json
  {
    "connectionId": "...",
    "clientName": "Acme LLC",
    "propertyAddress": "123 Main St",
    "lineItems": [
      {"name":"Mulch","description":"Brown mulch","quantity":3,"unitPrice":45}
    ],
    "notes": "Optional notes"
  }
  ```
  - Uses `getValidAccessToken(connectionId)` with auto-refresh if expiring within 2 min
  - Executes mutation pattern for quote create (with TODOs for schema/account mapping)

- `GET /api/jobber/test?connectionId=...`
  - Executes lightweight GraphQL query to verify auth

- `GET /api/health`
  - Health check endpoint

## Jobber Developer Center configuration
Create app in Jobber Developer Center with:
- App name: `CoenGPT Estimator`
- Developer name: `Coen Construction`
- Callback URL: `https://app.coenconstruction.com/jobber/callback`
- Manage App URL: `https://app.coenconstruction.com/connections`
- Webhook URL: `https://app.coenconstruction.com/webhooks/jobber`

Scopes guidance (minimum viable):
- Start with read/write scopes only for quotes, clients, and properties required by estimator workflows.
- Avoid broad scopes you do not need.

Important:
- Callback URL must match `redirect_uri` exactly, including protocol and path.

## Deploy to GitHub + Vercel

### 1) Push to GitHub
```bash
git init
git add .
git commit -m "Initial CoenGPT Jobber integration"
git branch -M main
git remote add origin https://github.com/<your-org>/<repo>.git
git push -u origin main
```

### 2) Import repo into Vercel
1. Go to Vercel dashboard.
2. Click **Add New Project**.
3. Import the GitHub repository.
4. Framework preset: Next.js.

### 3) Configure environment variables in Vercel
Add all values from `.env.example` to:
- Production
- Preview (optional)
- Development (optional)

### 4) Configure database migration on deploy
Recommended:
- `postinstall` already runs `prisma generate` in this repo.
- Run `npm run prisma:migrate` via Vercel build command or a deploy hook.

Suggested Vercel build command:
```bash
npm run prisma:migrate && npm run build
```

### 5) Add custom domain
In Vercel Project Settings > Domains:
- Add `app.coenconstruction.com`
- Vercel gives a CNAME target such as `cname.vercel-dns.com`

### 6) Add DNS in Squarespace
In Squarespace DNS settings:
- Type: `CNAME`
- Host: `app`
- Points to: Vercel CNAME target (example: `cname.vercel-dns.com`)

After DNS propagates, Vercel issues SSL automatically.

### 7) Auto deploy behavior
Vercel auto-deploys on git push to configured branches. No GitHub Actions required.

## Security and safety notes
- Tokens are stored server-side only in Postgres.
- OAuth code exchange and refresh use server routes only.
- Never expose `JOBBER_CLIENT_SECRET` to the browser.
- Webhook signature verification is performed on raw body before JSON parse.
- Webhook route is fast and queues work by writing to DB `Job` records.
- Code includes TODOs for mapping Jobber account identifiers to local `connectionId`.

## Operational TODOs before production launch
1. Confirm exact Jobber GraphQL schema fields for quote create/update mutation.
2. Implement account/user-based upsert logic in OAuth callback to avoid duplicate connections.
3. Add background worker for `Job` queue processing (Cron or queue service).
4. Add audit logging and alerting around webhook failures.
