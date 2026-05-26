# Revie

A Telegram bot that summarizes Google Maps reviews using AI. Paste a Google Maps link or type a place name — Revie fetches real reviews, generates a summary, and lets you ask follow-up questions about the place.

## How It Works

1. User sends a place name or Google Maps link
2. Revie finds the place via [SerpAPI](https://serpapi.com) (Google Maps search)
3. Fetches real reviews from Google Maps
4. Uses [Groq](https://groq.com) (Llama 3.3 70B) to generate a structured summary
5. Builds a knowledge profile for follow-up questions
6. User can ask unlimited follow-up questions about the place

## Project Structure

```
├── server/          # Backend (Bun + TypeScript)
│   └── src/
│       ├── index.ts           # HTTP server + webhook handler
│       ├── types.ts           # Shared type definitions
│       ├── bot/
│       │   ├── handler.ts     # Telegram update router (state machine)
│       │   ├── commands.ts    # /start, /help, /end, /search
│       │   └── sender.ts     # Telegram API helpers
│       ├── core/
│       │   ├── pipeline.ts    # Main flow: search → reviews → summarize
│       │   └── prompts.ts    # LLM prompt templates
│       ├── services/
│       │   ├── serpapi.ts     # Google Maps place + review fetching
│       │   ├── llm.ts        # Groq/LLM client
│       │   ├── supabase.ts   # Session persistence
│       │   └── analytics.ts  # Usage event tracking
│       └── lib/
│           └── constants.ts
└── web/             # Marketing website (coming soon)
```

## Setup

### Prerequisites

- [Bun](https://bun.sh) runtime
- [Telegram Bot](https://core.telegram.org/bots#botfather) token
- [SerpAPI](https://serpapi.com) key
- [Groq](https://console.groq.com) API key (free tier)
- [Supabase](https://supabase.com) project

### Environment Variables

Copy `.env.example` to `.env` in the `server/` directory:

```
GROQ_API_KEY=your_groq_api_key
SERPAPI_KEY=your_serpapi_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WEBHOOK_SECRET=a_random_string_for_webhook_security
PORT=3000
```

### Database Setup

Run these SQL statements in your Supabase SQL Editor:

**Sessions table** — stores active user sessions:

```sql
create table sessions (
  chat_id bigint primary key,
  state text not null default 'IDLE',
  current_place jsonb,
  knowledge_profile text,
  messages jsonb not null default '[]',
  pending_places jsonb,
  updated_at timestamptz default now()
);
```

**Events table** — usage analytics:

```sql
create table events (
  id bigint generated always as identity primary key,
  chat_id bigint not null,
  event text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

create index idx_events_created_at on events (created_at);
create index idx_events_chat_id on events (chat_id);
```

### Run Locally

```bash
cd server
bun install
bun run src/index.ts
```

## Deployment

The server is deployed to **Google Cloud Run** via GitHub Actions. Pushing to `master` with changes in `server/` triggers a build and deploy automatically.

The workflow (`.github/workflows/deploy.yml`) handles:
1. Building the Docker image
2. Pushing to Google Container Registry
3. Deploying to Cloud Run
4. Setting the Telegram webhook to the new URL

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `GCP_SA_KEY` | GCP service account key (JSON) |
| `GROQ_API_KEY` | Groq API key |
| `SERPAPI_KEY` | SerpAPI key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Random string for webhook verification |

## Analytics

Events are logged to the `events` table in Supabase. Four event types are tracked:
- `search` — user searched for a place
- `place_selected` — reviews were fetched for a place
- `follow_up` — user asked a follow-up question
- `session_cleared` — user ended their session

### Useful Queries

**Unique users today:**

```sql
select count(distinct chat_id) from events
where created_at > now() - interval '1 day';
```

**Event breakdown this week:**

```sql
select event, count(*) from events
where created_at > now() - interval '7 days'
group by event order by count desc;
```

**Most searched places:**

```sql
select metadata->>'name' as place, count(*) from events
where event = 'place_selected'
group by place order by count desc limit 10;
```

**Daily active users over time:**

```sql
select date(created_at) as day, count(distinct chat_id) as users
from events group by day order by day;
```

**Searches that found no results:**

```sql
select metadata->>'query' as query, count(*) from events
where event = 'search' and (metadata->>'results')::int = 0
group by query order by count desc limit 10;
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message + instructions |
| `/help` | Show available commands |
| `/search <place>` | Search for a place by name |
| `/newsearch <place>` | Same as `/search` |
| `/end` | Clear session and start fresh |
