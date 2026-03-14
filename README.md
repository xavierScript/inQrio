# Inqrio

**Inqrio** is a learning and assessment platform designed to track academic progress, quiz performance, and tournament participation using verifiable records.

The goal is to create a transparent system where learners can measure their improvement, participate in knowledge competitions, and build a credible learning history.

---

## Project Structure

This repository is organized as a **monorepo** containing multiple applications and services.
This repository is organized as a monorepo. Project layout (clean ASCII view):

inqrio/
├─ apps/
│ ├─ web/ — Web app (student dashboard, quizzes, tournaments)
│ └─ mobile/ — Mobile app (future)
├─ services/
│ └─ backend/ — API, quiz engine, scoring & leaderboards
├─ programs/
│ └─ solana/ — Solana Anchor program (on-chain records)
├─ packages/
│ ├─ sdk/ — Client SDK
│ ├─ types/ — Shared TypeScript types
│ └─ ui/ — Shared UI components
├─ docs/ — Architecture & specs
├─ scripts/ — Utility scripts
└─ README.md — Repo overview

---

## Core Idea

Inqrio focuses on **verifiable learning progress**.

The platform records:

- quiz attempts
- scores
- topic mastery
- subject progress
- tournament participation

These records help create a **transparent and reliable academic performance history**.

---

## MVP Features

The initial version of Inqrio includes:

- learner profile creation
- quiz attempt tracking
- topic completion evaluation
- subject progress tracking
- academic tournaments
- tournament leaderboards

The MVP does **not include tokens or rewards**.  
The focus is purely on **learning progress and fair competition**.

---

## Tech Stack

Planned technologies:

- **Solana + Anchor** — on-chain learning records
- **Node.js** — backend services
- **PostgreSQL/MongoDB** — quiz data storage
- **Next.js / React** — web application
- **Tailwind CSS** — UI styling

---

## Vision

Inqrio aims to become a platform where learners can:

- track their academic improvement
- compete in knowledge tournaments
- showcase verified learning achievements
- access educational opportunities based on performance

---

## Status

🚧 Currently in development.

The project is focused on building the **core MVP infrastructure**.
