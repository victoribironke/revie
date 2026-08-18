# Revie

A Telegram bot that provides AI-powered place recommendations and summarizes Google Maps reviews. Ask for recommendations (e.g., _"good cafe spots in Lagos"_, _"best rooftop bars in VI"_), paste any link (Google Maps, Instagram, website), or type a place name — Revie finds top spots, fetches real reviews and broader web info, generates structured summaries, and lets you chat conversationally with the reviews of each place.

## How It Works

1. **Recommendation / Search**: User asks for recommendations (e.g., _"recommend good cafes in Lagos"_) or sends a specific place / link.
2. **AI Tool Calling**: LLM detects intent and triggers either `recommend_places` or `search_place`.
3. **SerpAPI Ranking & Google Maps**:
   - For recommendations: SerpAPI fetches local results, ranks candidates by rating quality and review volume, and presents a curated list with inline buttons.
   - For specific searches: Finds the place directly or offers disambiguation buttons.
4. **Deep-Dive Review Summary**: Tapping any place fetches real Google Maps reviews and broader web context via [Tavily](https://tavily.com).
5. **AI Synthesis**: [Groq](https://groq.com) (Llama 3.3 70B) generates a structured Hero summary and builds a structured knowledge profile.
6. **Chat with Reviews**: User can ask conversational follow-up questions about WiFi, vibe, price, parking, or easily navigate back to the recommendation list.

## Project Structure

```
├── server/          # Backend (Bun + TypeScript)
│   └── src/
│       ├── index.ts           # HTTP server + webhook handler
│       ├── types.ts           # Shared type definitions
│       ├── bot/
│       │   ├── handler.ts     # Telegram update router (state machine & tool calls)
│       │   ├── commands.ts    # /start, /help, /recommend, /search, /end
│       │   └── sender.ts     # Telegram API helpers
│       ├── core/
│       │   ├── pipeline.ts    # Recommendations, search, reviews, and summarize
│       │   └── prompts.ts    # LLM prompt templates
│       ├── services/
│       │   ├── serpapi.ts     # Google Maps place + review + recommendation fetching
│       │   ├── llm.ts        # Groq/LLM client & tool calling
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
- [Tavily](https://tavily.com) API key
- [Groq](https://console.groq.com) API key (free tier)
- [Supabase](https://supabase.com) project

### Environment Variables

Copy `.env.example` to `.env` in the `server/` directory:

```
GROQ_API_KEY=your_groq_api_key
SERPAPI_KEY=your_serpapi_key
TAVILY_API_KEY=your_tavily_api_key
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
  recommendation_query text,
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

| Secret                      | Description                            |
| --------------------------- | -------------------------------------- |
| `GCP_SA_KEY`                | GCP service account key (JSON)         |
| `GROQ_API_KEY`              | Groq API key                           |
| `SERPAPI_KEY`               | SerpAPI key                            |
| `TAVILY_API_KEY`            | Tavily API key                         |
| `SUPABASE_URL`              | Supabase project URL                   |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key              |
| `TELEGRAM_BOT_TOKEN`        | Telegram bot token from BotFather      |
| `TELEGRAM_WEBHOOK_SECRET`   | Random string for webhook verification |

## Analytics

Events are logged to the `events` table in Supabase. Five event types are tracked:

- `search` — user searched for a specific place
- `recommendation` — user asked for place recommendations
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

**Most searched & recommended places:**

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

| Command                 | Description                               |
| ----------------------- | ----------------------------------------- |
| `/start`                | Welcome message + instructions            |
| `/help`                 | Show available commands                   |
| `/recommend <category>` | Get ranked recommendations in a city/area |
| `/suggest <category>`   | Same as `/recommend`                      |
| `/search <place>`       | Search for a place by name                |
| `/newsearch <place>`    | Same as `/search`                         |
| `/end`                  | Clear session and start fresh             |
