// src/index.ts
//
// 📚 LEARN: Server Entry Point & Graceful Shutdown
//
// This file is the ONLY place where:
//   1. External connections are opened (Redis, then the HTTP server)
//   2. The process listens for OS signals to shut down cleanly
//
// WHY graceful shutdown matters:
//   When Docker (or Kubernetes) wants to stop your container, it sends a
//   SIGTERM signal. If you ignore it and just kill the process, any in-flight
//   requests get dropped — bad UX. Graceful shutdown means:
//     a) Stop accepting new requests
//     b) Wait for in-flight requests to complete
//     c) Close DB/Redis connections cleanly
//     d) Exit with code 0

import dotenv from 'dotenv';
dotenv.config(); // Must be first — loads .env before any other import reads process.env

import { app } from './app';
import { redis } from './lib/redis';
import { prisma } from './lib/prisma';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  try {
    // 1. Connect to Redis first — if this fails, we know immediately
    await redis.connect();

    // 2. Start the HTTP server
    const server = app.listen(PORT, () => {
      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀 inQrio API running on http://localhost:${PORT}
  📦 Environment: ${process.env.NODE_ENV || 'development'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Endpoints:
    GET  /health
    GET  /api/exams
    GET  /api/exams/:examRefId
    GET  /api/exams/:examRefId/questions/random
    POST /api/exams/:examRefId/submit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    });

    // ── Graceful Shutdown ─────────────────────────────────────────────────────
    const shutdown = async (signal: string) => {
      console.log(`\n[${signal}] Shutting down gracefully...`);

      // Stop accepting new connections
      server.close(async () => {
        console.log('HTTP server closed');

        // Close Redis connection
        await redis.quit();
        console.log('Redis connection closed');

        // Close Prisma/Postgres connection pool
        await prisma.$disconnect();
        console.log('Database connection closed');

        process.exit(0);
      });

      // Force exit after 10s if something hangs
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM')); // Docker/K8s stop
    process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C in terminal

  } catch (error) {
    console.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
