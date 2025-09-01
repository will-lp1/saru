# Saru (formerly Snow Leopard)

Monorepo:
- **apps/saru**: Next.js app
- **packages/db**: Drizzle schema & migrations

## Tech Stack
- Next.js (App Router), TypeScript, React
- TailwindCSS, Shadcn UI
- PostgreSQL, Drizzle ORM
- Better Auth 
- Vercel AI SDK
- Tavily (for web search)

## Setup

From the project root:

1. Clone & install:
   ```bash
   git clone https://github.com/will-lp1/saru.git
   cd saru
   pnpm install
   ```

2. Copy env files:
   ```bash
   cp packages/db/.env.example packages/db/.env
   cp apps/saru/.env.example apps/saru/.env
   ```
   - Set **DATABASE_URL** in both.
   - In `apps/saru/.env`, add:
     ```dotenv
     BETTER_AUTH_SECRET=""        # e.g., openssl rand -hex 32
     BETTER_AUTH_URL="http://localhost:3000"
     DISCORD_WEBHOOK_URL=""
     # AI Keys: GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
     ```

3. Start the database:
   ```bash
   docker compose up -d
   ```

4. Apply schema:
   ```bash
   pnpm db:push
   ```

5. Run the app:
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Database Management

- **Start**: `docker compose up -d`
- **Stop**: `docker compose down`
- **Sync schema**: `pnpm db:push`
- **Generate migration**: `pnpm db:generate`
- **Apply migrations**: `pnpm db:migrate`
- **Studio**: `pnpm db:studio`

## Contributing

1. Fork the repo.
2. Create a branch (`feature/...` or `fix/...`).
3. Commit, push, and open a PR.

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.
