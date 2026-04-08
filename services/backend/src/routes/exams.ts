// src/routes/exams.ts
//
// 📚 LEARN: Express Router
//
// Instead of defining all routes in one giant file, Express lets you create
// "mini-apps" called Routers. Each Router handles a slice of your API.
// This file owns everything under /api/exams.
//
// The pattern for each handler is always:
//   1. Parse the request (params, query, body)
//   2. Validate inputs
//   3. Try to serve from cache (Redis)
//   4. Fall back to database (Prisma)
//   5. Populate cache for next time
//   6. Return the response

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

export const examsRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exams
// List all exams, with optional filters.
// Query params: ?examBoard=JAMB&subject=Chemistry&year=1983&page=1&limit=20
// ─────────────────────────────────────────────────────────────────────────────
examsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { examBoard, subject, year, page = '1', limit = '20' } = req.query;

    // 📚 LEARN: Pagination
    // Never return ALL rows from a table — that's a performance disaster waiting
    // to happen. We calculate an `offset` (how many rows to skip) from the
    // requested page number and limit.
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, parseInt(limit as string)); // cap at 100
    const skip = (pageNum - 1) * limitNum;

    // Build dynamic filter object — only add fields that were actually provided
    const where: Record<string, unknown> = {};
    if (examBoard) where.examBoard = (examBoard as string).toUpperCase();
    if (subject) where.subject = { contains: subject as string, mode: 'insensitive' };
    if (year) where.year = parseInt(year as string);

    // Run both queries in parallel — get the data AND the total count at once
    // 📚 LEARN: Promise.all runs promises concurrently. If you awaited them
    // sequentially, you'd wait for query1 to finish before starting query2.
    const [exams, total] = await Promise.all([
      prisma.exam.findMany({
        where,
        skip,
        take: limitNum,
        select: {
          id: true,
          examRefId: true,
          title: true,
          examBoard: true,
          subject: true,
          year: true,
          _count: { select: { questions: true } }, // question count per exam
        },
        orderBy: [{ examBoard: 'asc' }, { year: 'desc' }],
      }),
      prisma.exam.count({ where }),
    ]);

    res.json({
      data: exams,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('[GET /api/exams]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exams/:examRefId
// Fetch a single exam with ALL its questions. Redis-cached for 1 hour.
// ─────────────────────────────────────────────────────────────────────────────
examsRouter.get('/:examRefId', async (req: Request, res: Response) => {
  const examRefId = req.params.examRefId as string;
  const cacheKey = `exam:${examRefId}`;

  try {
    // ── Step 1: Check Redis cache ─────────────────────────────────────────────
    // 📚 LEARN: Cache-Aside Pattern
    // The application is responsible for loading data into the cache.
    // Steps: check cache → miss? hit DB → store in cache → return data.
    // This is the most common caching pattern for read-heavy APIs.
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({ source: 'cache', data: JSON.parse(cached) });
    }

    // ── Step 2: Query PostgreSQL via Prisma ───────────────────────────────────
    const exam = await prisma.exam.findUnique({
      where: { examRefId },
      include: {
        questions: {
          orderBy: { questionRefId: 'asc' }, // stable ordering
        },
      },
    });

    if (!exam) {
      return res.status(404).json({ error: `Exam '${examRefId}' not found` });
    }

    // ── Step 3: Store in Redis (TTL = 1 hour = 3600 seconds) ─────────────────
    // 📚 LEARN: TTL (Time To Live)
    // setEx sets a key that automatically expires. After 3600s Redis deletes it.
    // If question data is updated in Postgres, we should also call redis.del(cacheKey)
    // to invalidate the stale cache — we'll add that to the update routes later.
    await redis.setEx(cacheKey, 3600, JSON.stringify(exam));

    // ── Step 4: Respond ───────────────────────────────────────────────────────
    return res.json({ source: 'database', data: exam });
  } catch (error) {
    console.error(`[GET /api/exams/${examRefId}]`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exams/:examRefId/questions/random
// Return N random questions from an exam, optionally filtered by topic.
// Query params: ?count=10&topic=Organic+Chemistry
//
// 📚 LEARN: WHY this endpoint exists
// For "practice mode" the mobile app shouldn't just load all 50 questions
// in order — that's predictable and students memorize position, not content.
// This endpoint powers randomized, topic-specific practice sessions.
// ─────────────────────────────────────────────────────────────────────────────
examsRouter.get('/:examRefId/questions/random', async (req: Request, res: Response) => {
  const examRefId = req.params.examRefId as string;
  const count = Math.min(50, Math.max(1, parseInt((req.query.count as string) || '10')));
  const topic = req.query.topic as string | undefined;

  try {
    // First find the exam to get its ID
    const exam = await prisma.exam.findUnique({
      where: { examRefId },
      select: { id: true, title: true },
    });

    if (!exam) {
      return res.status(404).json({ error: `Exam '${examRefId}' not found` });
    }

    // Build the question filter
    const whereClause: Record<string, unknown> = { examId: exam.id };
    if (topic) {
      whereClause.topic = { contains: topic, mode: 'insensitive' };
    }

    // 📚 LEARN: Random ordering in PostgreSQL
    // True random rows from a DB is tricky at scale. For our data size
    // (< 100 questions per exam), fetching all and shuffling in JS is fine.
    // At massive scale (millions of rows), you'd use reservoir sampling or
    // a dedicated random-row strategy. We'll cross that bridge later.
    const allQuestions = await prisma.question.findMany({
      where: whereClause,
      select: {
        id: true,
        questionRefId: true,
        text: true,
        options: true,
        topic: true,
        // NOTE: We intentionally exclude `correctOption` and `explanation`
        // here. The client submits answers, THEN we validate server-side.
        // Never send answers with the questions — that's a cheat waiting to happen.
      },
    });

    // Fisher-Yates shuffle, then take `count` items
    const shuffled = allQuestions.sort(() => Math.random() - 0.5).slice(0, count);

    return res.json({
      examTitle: exam.title,
      topic: topic || 'All topics',
      count: shuffled.length,
      questions: shuffled,
    });
  } catch (error) {
    console.error(`[GET /api/exams/${examRefId}/questions/random]`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/exams/:examRefId/submit
// Validate a submitted set of answers and return the score.
//
// 📚 LEARN: Why server-side validation matters
// The correct answers should NEVER be sent to the client upfront.
// The mobile app sends { questionId, selectedOption } pairs to this endpoint,
// and the server looks up the real correct answers in the DB.
// This prevents cheating by intercepting the network response.
// ─────────────────────────────────────────────────────────────────────────────
examsRouter.post('/:examRefId/submit', async (req: Request, res: Response) => {
  const examRefId = req.params.examRefId as string;

  // Expected body: { answers: [{ questionId: "uuid", selectedOption: "A" }] }
  const { answers } = req.body as {
    answers: { questionId: string; selectedOption: string }[];
  };

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers array is required' });
  }

  try {
    // Fetch only the questions that were answered (by their IDs)
    const questionIds = answers.map((a) => a.questionId);
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, correctOption: true, explanation: true, topic: true },
    });

    // Map questions to a lookup for O(1) access
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // Grade each answer
    const results = answers.map((answer) => {
      const question = questionMap.get(answer.questionId);
      if (!question) return null;

      const isCorrect = question.correctOption === answer.selectedOption.toUpperCase();
      return {
        questionId: answer.questionId,
        selectedOption: answer.selectedOption.toUpperCase(),
        correctOption: question.correctOption,
        isCorrect,
        explanation: question.explanation,
        topic: question.topic,
      };
    });

    const validResults = results.filter(Boolean);
    const correctCount = validResults.filter((r) => r?.isCorrect).length;
    const score = Math.round((correctCount / validResults.length) * 100);

    return res.json({
      examRefId,
      score,
      correctCount,
      totalAnswered: validResults.length,
      percentage: `${score}%`,
      results: validResults,
    });
  } catch (error) {
    console.error(`[POST /api/exams/${examRefId}/submit]`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
