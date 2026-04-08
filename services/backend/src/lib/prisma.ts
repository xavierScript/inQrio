// src/lib/prisma.ts
//
// 📚 LEARN: Singleton Pattern for Database Clients
//
// Every time you call `new PrismaClient()`, it opens a new connection pool
// to your database. In a Node.js server, modules are cached after the first
// import — meaning this file runs once and the same `prisma` instance is
// reused across every route handler.
//
// Without this singleton:
//   - In development with hot-reload (nodemon), each file change would
//     spawn a new pool, quickly exhausting the DB's max connections.
//   - You'd see "too many connections" errors under load.
//
// The `globalThis` trick prevents re-creating the client during hot-reloads
// in development while still being a simple import in production.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
