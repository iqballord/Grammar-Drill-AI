# Grammar Learning Bot - Backend

Backend server for the English Grammar Learning Ecosystem based on Raymond Murphy's "Essential Grammar in Use 4th Edition".

## 🎯 What We've Built (Phases 1-3)

### ✅ Completed Features

1. **Project Foundation** (Phase 1)
   - TypeScript + Node.js backend
   - Telegraf.js for Telegram bot
   - PostgreSQL database with Prisma ORM
   - Complete project structure

2. **Database Schema**
   - `User` - Telegram users
   - `Unit` - Grammar units (1-115)
   - `Question` - AI-generated questions
   - `QuizAttempt` - User quiz attempts and results

3. **AI Integration** (Phase 2)
   - Gemini 2.5 Flash model ✨
   - Murphy's teaching pedagogy in system prompt
   - Strict JSON validation with Zod
   - Three question types: MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_THE_BLANK

4. **Telegram Bot** (Phase 3) 🤖
   - `/start` - Welcome & instructions
   - `/help` - Help documentation
   - `/study [unit]` - AI-powered questions
   - `/stats` - Progress tracking
   - Inline keyboards for MCQ & True/False
   - Text input for Fill-in-the-Blank
   - Answer validation & feedback
   - Database logging

## 🔧 Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN` - Get from [@BotFather](https://t.me/botfather)
- `GEMINI_API_KEY` - Get from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 3. Setup Database
```bash
# Run migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate
```

### 4. Run Development Server
```bash
npm run dev
```

## 📚 Understanding Telegram Bot Modes

### Polling Mode (Development) ✅ Recommended for Local
- Bot actively asks Telegram: "Any new messages?"
- Easy to set up - no public URL needed
- Works on localhost
- **We're using this for development** (`USE_WEBHOOK=false`)

### Webhook Mode (Production)
- Telegram sends messages to your server URL
- Requires HTTPS and public domain
- More efficient for high-traffic bots
- Example: `WEBHOOK_URL=https://yourdomain.com/webhook`

**For local development, ignore `WEBHOOK_URL` - we use polling!**

## 🗂️ Project Structure

```
backend/
├── src/
│   ├── ai/
│   │   ├── config.ts          # Gemini client + Murphy system prompt
│   │   └── generator.ts       # AI question generator
│   ├── bot/
│   │   ├── handlers/          # Command handlers (/start, /study)
│   │   ├── keyboards/         # Inline keyboards
│   │   └── scenes/            # Conversation flows
│   ├── db/
│   │   └── client.ts          # Prisma database client
│   ├── validation/
│   │   └── schemas.ts         # Zod validation schemas
│   └── api/                   # REST API endpoints
├── prisma/
│   └── schema.prisma          # Database schema
├── .env                       # Your environment variables
└── package.json
```

## 🧪 Testing AI Generation

After setting up your `GEMINI_API_KEY`, you can test question generation:

```typescript
import { testQuestionGeneration } from './src/ai/generator';

// Test generating a question for Unit 5 (Present Simple)
await testQuestionGeneration(5);
```

## 📝 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production server
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:studio` - Open Prisma Studio (DB GUI)

## 🔐 Getting Your API Keys

### Telegram Bot Token
1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Follow the instructions to name your bot
4. Copy the token and paste in `.env`

### Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with Google account
3. Click "Create API Key"
4. Copy and paste in `.env`

## 🎓 Question Types

### 1. MULTIPLE_CHOICE
4 options displayed as inline keyboard buttons.

```json
{
  "type": "MULTIPLE_CHOICE",
  "question": "She ___ to the gym every day.",
  "options": ["go", "goes", "going", "gone"],
  "correct_answer": "goes"
}
```

### 2. TRUE_FALSE
2 options: True or False.

```json
{
  "type": "TRUE_FALSE",
  "question": "We use 'am/is/are + -ing' for present continuous.",
  "options": ["True", "False"],
  "correct_answer": "True"
}
```

### 3. FILL_IN_THE_BLANK
User types the answer.

```json
{
  "type": "FILL_IN_THE_BLANK",
  "question": "I ___ hungry. Can we eat?",
  "options": null,
  "correct_answer": "am"
}
```

## 🚀 How to Test the Bot

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Open Telegram** and search for your bot (use the bot username you got from @BotFather)

3. **Try these commands:**
   - `/start` - Get started
   - `/help` - View help
   - `/study 5` - Practice Unit 5 (Present Simple)
   - `/study 12` - Practice Unit 12 (Present Continuous)
   - `/stats` - View your progress

4. **Test all question types:**
   - Multiple Choice: Click buttons to answer
   - True/False: Click True or False
   - Fill-in-the-Blank: Type your answer

## 📝 Next Steps

**Phase 4: Backend API** (For Dashboard)
- [ ] Create REST endpoints for quiz data
- [ ] Build statistics aggregation API
- [ ] Create error bank endpoint

**Phase 5: Next.js Dashboard**
- [ ] Build UI with shadcn/ui
- [ ] Show user progress
- [ ] Display mastery chart
- [ ] Error review system

## 📖 Resources

- [Telegraf.js Docs](https://telegraf.js.org/)
- [Prisma Docs](https://www.prisma.io/docs)
- [Gemini API Docs](https://ai.google.dev/docs)
- [Zod Docs](https://zod.dev/)

## 🐛 Troubleshooting

### Database Connection Error
Make sure PostgreSQL is running:
```bash
# macOS (Homebrew)
brew services start postgresql

# Check status
brew services list
```

### Prisma Client Not Found
Generate Prisma client:
```bash
npm run prisma:generate
```

### Gemini API Error
- Check if API key is correct in `.env`
- Verify you have API quota remaining
- Check [Google AI Studio](https://aistudio.google.com/) for errors

---

Built with ❤️ for English learners
