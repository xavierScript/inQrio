// src/app.ts
//
// 📚 LEARN: Separating the Express "app" from the HTTP server
//
// We split the Express app config (this file) from the server startup
// (index.ts). Why? Because if you ever want to write integration tests,
// you can import `app` directly without actually starting a listening server.
// This is a universally accepted pattern in Node.js backends.

import express from 'express';
import cors from 'cors';
import { examsRouter } from './routes/exams';

export const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
// 📚 LEARN: Middleware
// In Express, middleware are functions that run on EVERY request before your
// route handler. They receive (req, res, next) and call next() to pass
// control down the chain.

// CORS: Allows browsers (and React Native) to make cross-origin requests.
// In production you'd whitelist specific origins, not allow all.
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })
);

// JSON body parser: Parses incoming requests with JSON payloads.
// After this runs, req.body is a parsed JS object.
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
// 📚 LEARN: Health endpoints
// Every production backend should have a /health endpoint. Load balancers
// (like AWS ALB or Kubernetes) ping this constantly. If it returns non-200,
// they stop routing traffic to that instance. It's the heartbeat of your service.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
// Mount the exams router at this prefix. All routes defined in examsRouter
// will be prefixed with /api/exams automatically.
app.use('/api/exams', examsRouter);

// ── 404 Handler ───────────────────────────────────────────────────────────────
// Any request that doesn't match a route ends up here.
// Must be registered AFTER all routes.
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});
