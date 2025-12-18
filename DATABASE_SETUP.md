# Database Setup for TestFlow AI

## Prerequisites

Make sure you have the following installed:
- Node.js 18+
- npm or yarn

## Environment Variables

Create a `.env.local` file in the root directory with:

```env
# Database
DATABASE_URL="file:./dev.db"

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=baidu/ernie-4.5-21b-a3b

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10

# Max tokens for AI responses
MAX_TOKENS=4000
```

## Database Setup

1. Install dependencies:
```bash
npm install
```

2. Generate Prisma client:
```bash
npx prisma generate
```

3. Run database migrations:
```bash
npx prisma db push
```

4. (Optional) View your database:
```bash
npx prisma studio
```

## Development

The app will automatically fall back to localStorage if the database is not available, so you can develop without setting up the database initially.

## Production

For production deployment:
1. Use PostgreSQL instead of SQLite
2. Set `DATABASE_URL` to your PostgreSQL connection string
3. Run `npx prisma migrate deploy` instead of `npx prisma db push`

## Troubleshooting

If you see "Parsing ecmascript source code failed":
1. Make sure all imports are correct
2. Check that function definitions are before their usage
3. Ensure all dependencies are installed
4. Try clearing Next.js cache: `rm -rf .next && npm run dev`
