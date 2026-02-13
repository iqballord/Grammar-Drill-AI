# English Grammar Learning Ecosystem - Development Plan

## Project Overview

Build a learning ecosystem for programmers to master English grammar based on **"Essential Grammar in Use 4th Edition"** by Raymond Murphy. The system consists of a Telegram Bot for mobile learning and a Next.js Dashboard for progress tracking.

---

## Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Telegram Framework**: Telegraf.js
- **Database**: PostgreSQL
- **ORM**: Prisma (recommended) or Drizzle
- **Validation**: Zod for schema enforcement
- **AI Integration**: OpenAI/Gemini API

### Frontend
- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Language**: TypeScript

---

## MVP Scope (Phase 1)

### Question Types
Implement **3 question types only**:

1. **MULTIPLE_CHOICE**: 4 options using Inline Keyboard
2. **TRUE_FALSE**: 2 options (True/False) using Inline Keyboard
3. **FILL_IN_THE_BLANK**: Text-based input from the user

### Grammar Units
- Cover all **115 units** from Raymond Murphy's book
- Each unit represents a specific grammar topic

---

## Core Features & Logic

### 1. Telegram Bot
- **Command**: `/study [unit_number]` triggers AI question generation for specific unit
- **Inline Keyboards**: MCQ and True/False for "one-thumb" mobile experience
- **After Every Answer**:
  - Save result (isCorrect, unit, type, timestamp) to database
  - Provide explanation based on grammar rules of that unit
- **User Experience**: Seamless learning during commuting

### 2. Next.js Dashboard
- **Overview**:
  - Total Questions Solved
  - Accuracy Rate (%)
  - Daily Streak counter
- **Mastery Chart**:
  - Progress bar or heatmap
  - Shows completion status of Units 1-115
- **Error Bank**:
  - shadcn/ui table component
  - Lists incorrectly answered questions for review

---

## Database Schema

### Tables

#### User
```sql
id: UUID (PK)
telegram_id: BigInt (Unique)
username: String
created_at: Timestamp
last_active: Timestamp
```

#### Unit
```sql
id: Int (PK, 1-115)
title: String
description: Text
murphy_page: Int
```

#### Question
```sql
id: UUID (PK)
unit_id: Int (FK)
type: Enum (MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_THE_BLANK)
question: Text
options: JSON (nullable for FILL_IN_THE_BLANK)
correct_answer: String
explanation: Text
created_at: Timestamp
```

#### QuizAttempt
```sql
id: UUID (PK)
user_id: UUID (FK)
question_id: UUID (FK)
unit_id: Int (FK)
user_answer: String
is_correct: Boolean
attempt_date: Timestamp
```

---

## AI Integration

### JSON Response Format
The AI must strictly return this JSON format:

```json
{
  "unit": 1,
  "type": "MULTIPLE_CHOICE",
  "question": "What is the correct form of the verb?",
  "options": ["go", "goes", "going", "gone"],
  "correct_answer": "goes",
  "explanation": "We use 'goes' with he/she/it in present simple (Unit 5)"
}
```

### System Prompt Design
- Act as a "strict English Teacher"
- Follow Raymond Murphy's pedagogy
- Generate questions aligned with specific unit content
- Provide clear, concise explanations referencing the unit

---

## API Endpoints

### Bot Backend
- `POST /webhook` - Receive Telegram updates
- `POST /generate-question` - AI question generation
- `POST /validate-answer` - Check user answer and save attempt

### Dashboard API
- `GET /api/user/:telegramId/stats` - User statistics
- `GET /api/user/:telegramId/mastery` - Unit progress (1-115)
- `GET /api/user/:telegramId/error-bank` - Incorrect answers
- `GET /api/leaderboard` - (Future: Top learners)

---

## Development Roadmap

### Phase 1: Project Foundation
- [ ] 1. Initialize Node.js backend project with TypeScript, Telegraf.js, and dependencies
- [ ] 2. Initialize Next.js frontend project with TypeScript, Tailwind CSS, and shadcn/ui
- [ ] 3. Setup PostgreSQL database and configure Prisma/Drizzle ORM
- [ ] 4. Design database schema (User, Unit, Question, QuizAttempt tables)
- [ ] 5. Create and run database migrations
- [ ] 6. Setup environment variables and configuration files

### Phase 2: AI & Validation Layer
- [ ] 7. Implement Zod schemas for question types and AI response validation
- [ ] 8. Setup OpenAI/Gemini API client with system prompt for Murphy's pedagogy
- [ ] 9. Implement AI question generation function with JSON validation

### Phase 3: Telegram Bot Development
- [ ] 10. Setup Telegraf.js bot with webhook configuration
- [ ] 11. Implement /start command for Telegram bot
- [ ] 12. Implement /study [unit_number] command with AI integration
- [ ] 13. Create inline keyboard handler for MULTIPLE_CHOICE questions
- [ ] 14. Create inline keyboard handler for TRUE_FALSE questions
- [ ] 15. Create text input handler for FILL_IN_THE_BLANK questions
- [ ] 16. Implement answer validation logic and database logging
- [ ] 17. Implement explanation delivery after each answer

### Phase 4: Backend API Development
- [ ] 18. Create API endpoint to save quiz attempts to database
- [ ] 19. Create API endpoint to fetch user statistics (total questions, accuracy, streak)
- [ ] 20. Create API endpoint to fetch mastery data (Unit 1-115 progress)
- [ ] 21. Create API endpoint to fetch error bank (incorrect answers)

### Phase 5: Dashboard UI Development
- [ ] 22. Setup Next.js dashboard layout with shadcn/ui components
- [ ] 23. Implement Overview section (Total Questions, Accuracy Rate, Daily Streak)
- [ ] 24. Implement Mastery Chart with progress bar/heatmap for Units 1-115
- [ ] 25. Implement Error Bank table using shadcn/ui table components
- [ ] 26. Add data fetching and state management for dashboard
- [ ] 27. Implement responsive design for mobile and desktop

### Phase 6: Testing & Deployment
- [ ] 28. Test all three question types in Telegram bot
- [ ] 29. Test inline keyboard interactions and answer flow
- [ ] 30. Verify database logging and data integrity
- [ ] 31. Test dashboard data visualization and accuracy
- [ ] 32. Validate AI JSON output format with error handling
- [ ] 33. Setup production database and environment
- [ ] 34. Deploy Node.js backend with Telegram webhook
- [ ] 35. Deploy Next.js dashboard to hosting platform
- [ ] 36. Write API documentation and user guide

---

## Key Technical Decisions

### Why Prisma?
- Type-safe database queries
- Excellent migration system
- Better TypeScript integration than Drizzle

### Why Inline Keyboards?
- Better mobile UX (one-thumb operation)
- No need to switch to typing mode for MCQ/True-False
- Instant callback handling

### Why Zod Validation?
- Strict AI JSON format enforcement
- Prevents parsing errors
- Type-safe validation with TypeScript

### Why Telegraf Scenes?
- Manage conversation state (waiting for answer, showing explanation)
- Handle multi-step flows elegantly

---

## Data Flow

### Question Generation Flow
1. User sends `/study 5` command
2. Bot extracts unit number (5)
3. Backend calls AI API with unit context
4. AI returns validated JSON question
5. Bot displays question with appropriate interface (keyboard/text)
6. User answers
7. Backend validates answer and saves to database
8. Bot shows explanation and correctness

### Dashboard Data Flow
1. User logs in with Telegram ID
2. Dashboard fetches user stats from API
3. API queries database for:
   - Total QuizAttempts count
   - Accuracy rate (correct/total)
   - Daily streak calculation
   - Unit-wise progress
   - Error bank records
4. Dashboard renders data using shadcn/ui components

---

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/grammar
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
OPENAI_API_KEY=your_openai_api_key
WEBHOOK_URL=https://yourdomain.com/webhook
PORT=3000
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

---

## Folder Structure

```
grammar/
├── backend/
│   ├── src/
│   │   ├── bot/
│   │   │   ├── handlers/
│   │   │   ├── keyboards/
│   │   │   └── scenes/
│   │   ├── ai/
│   │   │   ├── generator.ts
│   │   │   └── prompts.ts
│   │   ├── db/
│   │   │   ├── schema.prisma
│   │   │   └── client.ts
│   │   ├── validation/
│   │   │   └── schemas.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── dashboard/
│   ├── app/
│   │   ├── api/
│   │   ├── dashboard/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/ (shadcn components)
│   │   ├── overview.tsx
│   │   ├── mastery-chart.tsx
│   │   └── error-bank.tsx
│   ├── lib/
│   │   └── api.ts
│   ├── package.json
│   └── tsconfig.json
│
└── PLANNING.md (this file)
```

---

## Success Metrics (MVP)

- ✅ All 3 question types working in Telegram
- ✅ AI generates valid JSON 95%+ of the time
- ✅ Dashboard displays accurate user progress
- ✅ Response time < 2s for question generation
- ✅ Mobile-responsive dashboard
- ✅ No data loss in quiz attempts

---

## Future Enhancements (Post-MVP)

- Spaced repetition algorithm for review
- Unit content upload from Murphy's book (with permission)
- Telegram Mini App for richer dashboard experience

