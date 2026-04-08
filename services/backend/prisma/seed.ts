// prisma/seed.ts
//
// 📚 LEARN: Database Seeding
//
// A seed script populates your database with initial data.
// Key principle: ALWAYS make seed scripts idempotent (safe to run multiple times).
//
// We use Prisma's `upsert` for this:
//   - If the exam already exists (by examRefId) → UPDATE it
//   - If it doesn't exist → INSERT it
//   - Never duplicates data, never crashes on re-run
//
// The seed runs inside a transaction (prisma.$transaction) so if ANY question
// fails to insert, the ENTIRE operation rolls back. You'll never get an exam
// in the DB with only 10 of its 20 questions.

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ─── Type definitions matching our JSON structure ─────────────────────────────
interface ExamOption {
  key: string;
  text: string;
}

interface ExamQuestion {
  id: string;
  question: string;
  options: ExamOption[];
  correct_option: string;
  explanation: string;
  topic: string;
}

interface ExamData {
  id: string;           // e.g. "chem-1983"
  title: string;        // e.g. "JAMB Chemistry 1983"
  questions: ExamQuestion[];
}

// ─── Parse exam metadata from the ID and title ───────────────────────────────
// "chem-1983" → { subject: "Chemistry", year: 1983 }
// "JAMB Chemistry 1983" → { examBoard: "JAMB" }
function parseExamMetadata(examId: string, title: string) {
  // Extract year from the ID (last 4 digits)
  const yearMatch = examId.match(/(\d{4})$/);
  const year = yearMatch ? parseInt(yearMatch[1]) : 0;

  // Extract subject from the ID prefix (e.g. "chem" → "Chemistry")
  const subjectMap: Record<string, string> = {
    chem: 'Chemistry',
    math: 'Mathematics',
    maths: 'Mathematics',
    eng: 'English Language',
    phy: 'Physics',
    bio: 'Biology',
    govt: 'Government',
    econ: 'Economics',
    lit: 'Literature',
    geo: 'Geography',
  };
  const prefix = examId.split('-')[0].toLowerCase();
  const subject = subjectMap[prefix] || prefix;

  // Extract exam board from the title (first word)
  const examBoard = title.split(' ')[0].toUpperCase();

  return { year, subject, examBoard };
}

async function seedFile(filePath: string) {
  console.log(`\n📂 Processing: ${path.basename(filePath)}`);

  const raw = fs.readFileSync(filePath, 'utf-8');
  const examData: ExamData = JSON.parse(raw);

  const { year, subject, examBoard } = parseExamMetadata(examData.id, examData.title);

  console.log(`   Board: ${examBoard} | Subject: ${subject} | Year: ${year}`);
  console.log(`   Questions: ${examData.questions.length}`);

  // 📚 LEARN: Prisma Transactions
  // prisma.$transaction([]) runs a list of Prisma operations as a single
  // atomic database transaction. All succeed or all fail together.
  // This is critical for data integrity — you never want half an exam seeded.
  await prisma.$transaction(async (tx) => {
    // Upsert the exam record
    const exam = await tx.exam.upsert({
      where: { examRefId: examData.id },
      update: {
        title: examData.title,
        examBoard,
        subject,
        year,
      },
      create: {
        examRefId: examData.id,
        title: examData.title,
        examBoard,
        subject,
        year,
      },
    });

    // Upsert each question
    for (const q of examData.questions) {
      await tx.question.upsert({
        where: { questionRefId: q.id },
        update: {
          text: q.question,
          options: q.options as any,
          correctOption: q.correct_option,
          explanation: q.explanation,
          topic: q.topic,
        },
        create: {
          questionRefId: q.id,
          text: q.question,
          options: q.options as any,
          correctOption: q.correct_option,
          explanation: q.explanation,
          topic: q.topic,
          examId: exam.id,
        },
      });
    }

    console.log(`   ✅ Seeded: ${exam.title}`);
  });
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Find all JSON files in the data/ directory
  const dataDir = path.join(__dirname, '..', 'data');
  
  if (!fs.existsSync(dataDir)) {
    console.error(`❌ Data directory not found: ${dataDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('⚠️  No JSON files found in /data directory');
    return;
  }

  console.log(`Found ${files.length} exam file(s) to seed`);

  for (const file of files) {
    await seedFile(path.join(dataDir, file));
  }

  console.log('\n✨ Seed complete!');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
