// src/lib/redis.ts
//
// 📚 LEARN: Redis Client Singleton
//
// Redis is an in-memory data store. It's orders of magnitude faster than
// PostgreSQL for reads because everything lives in RAM (not disk).
//
// Use case here: When 500 students load the same "JAMB Chemistry 1983" exam,
// we don't want 500 separate round-trips to PostgreSQL. We hit Redis once
// per exam, cache the result for 1 hour, and every student after the first
// gets lightning-fast data from memory.
//
// The `createClient` from the `redis` v4 package returns a client that needs
// to be explicitly connected with `.connect()` — we do this in `index.ts`
// during server startup so we know immediately if Redis is unreachable.

import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err);
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});
