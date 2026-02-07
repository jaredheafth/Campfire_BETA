# Database Strategy for Campfire Widget

## Current Setup

The hosted platform is currently configured to use **PostgreSQL** as the primary database with **SQLite** as a development fallback.

## Database Options Compared

| Feature | PostgreSQL (Railway/Supabase) | Supabase | SQLite (sql.js) |
|---------|------------------------------|----------|-----------------|
| **Cost** | $5-20/month (Railway) | Free tier available | Free (local) |
| **Real-time** | Manual setup | Built-in subscriptions | Not suitable |
| **Auth** | Manual JWT | Built-in auth | Manual only |
| **Scaling** | Excellent | Excellent | Not scalable |
| **Setup** | Moderate | Easy | Easiest |
| **Backup** | Automated | Automated | Manual |
| **Edge Ready** | No | Yes | Yes (in-memory) |

## Recommendation: PostgreSQL on Railway

For this project, **PostgreSQL on Railway** is the best choice because:

### Why PostgreSQL?
- **Structured Data**: Users, Campfires, Buddies, Messages need relational integrity
- **ACID Compliance**: Critical for financial transactions (future monetization)
- **Scalability**: Can handle thousands of concurrent connections
- **Mature Ecosystem**: BestORM support, migrations, backups

### Why Railway?
- **Simple Setup**: One-click PostgreSQL provisioning
- **Unified Billing**: Database + App in one place
- **Good Free Tier**: $5 credit/month for hobby projects
- **Easy Scaling**: Upgrade with one click

## Alternative: Supabase (PostgreSQL + Auth + Real-time)

Supabase is an open-source Firebase alternative built on PostgreSQL. It provides:

### Supabase Advantages
- **Built-in Authentication** (saves development time)
- **Real-time Subscriptions** (built-in WebSocket for live updates)
- **Edge Functions** (serverless JavaScript)
- **Storage** (for user avatars, sprites)
- **Auto-generated APIs** (REST and GraphQL)

### Supabase Considerations
- **Vendor Lock-in**: Uses Supabase-specific features
- **Cost at Scale**: Overage charges can add up
- **Learning Curve**: New API patterns to learn

## Recommendation: Stick with Railway PostgreSQL

**For now, continue with Railway PostgreSQL** because:

1. ✅ Already implemented in the code
2. ✅ No vendor lock-in (standard PostgreSQL)
3. ✅ Railway's free tier is generous enough
4. ✅ Keep auth under your control (not tied to Supabase)
5. ✅ Real-time is already implemented via Socket.io

## Migration Path to Supabase (Future)

If you later decide to switch to Supabase, the migration is straightforward:

```javascript
// Current Railway setup
// const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Supabase setup (future)
// import { createClient } from '@supabase/supabase-js'
// const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
```

The database schema remains the same - only the connection client changes.

## Implementation Details

### Current Database Schema
- `users` - User profiles, preferences, stats
- `campfires` - Creator-owned virtual spaces
- `campfire_members` - Members with roles (owner, mod, member)
- `buddies` - Friendship relationships
- `buddy_requests` - Pending friend requests
- `messages` - Chat and private messages
- `sessions` - JWT session tokens
- `achievements` - User achievements and badges

### Environment Variables
```
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### Switching to Supabase (Optional)

1. Create Supabase project at supabase.com
2. Run the schema SQL in Supabase SQL editor
3. Update environment variables:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-key
   ```
4. Replace the database client in `database/connection.js`

## Summary

**Stick with Railway PostgreSQL** for:
- Maximum control over your data
- No vendor lock-in
- Industry-standard technology
- Sufficient for current and near-term needs

**Consider Supabase later** if you need:
- Faster development (built-in auth)
- Real-time subscriptions (database-level)
- File storage (user uploads)

Both are PostgreSQL under the hood, so switching is always possible.
