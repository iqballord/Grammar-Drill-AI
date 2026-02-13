# Grammar Learning API Documentation

REST API for the Grammar Learning Dashboard built with Express.js.

## Base URL

```
http://localhost:3001/api
```

---

## Endpoints

### 1. Health Check

**GET** `/health`

Check if the API server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-02-13T10:00:00.000Z"
}
```

---

### 2. User Statistics

**GET** `/api/stats/:telegramId`

Get comprehensive statistics for a specific user.

**Parameters:**
- `telegramId` (path) - User's Telegram ID

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "telegramId": "123456789",
    "username": "john_doe",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastActive": "2024-02-13T10:00:00.000Z"
  },
  "stats": {
    "totalQuestions": 50,
    "correctAnswers": 40,
    "incorrectAnswers": 10,
    "accuracy": 80,
    "dailyStreak": 5,
    "unitsPracticed": 12,
    "totalUnits": 115,
    "recentActivity": 10
  }
}
```

**Example:**
```bash
curl http://localhost:3001/api/stats/123456789
```

---

### 3. Mastery Data

#### 3.1 All Units Mastery

**GET** `/api/mastery/:telegramId`

Get mastery data for all 115 units.

**Parameters:**
- `telegramId` (path) - User's Telegram ID

**Response:**
```json
{
  "summary": {
    "totalUnits": 115,
    "practicedUnits": 25,
    "masteredUnits": 10,
    "averageAccuracy": 75,
    "progress": 22
  },
  "units": [
    {
      "unitId": 1,
      "totalQuestions": 10,
      "correctAnswers": 9,
      "incorrectAnswers": 1,
      "accuracy": 90,
      "masteryLevel": "mastered",
      "lastPracticed": "2024-02-13T10:00:00.000Z"
    },
    {
      "unitId": 2,
      "totalQuestions": 0,
      "correctAnswers": 0,
      "incorrectAnswers": 0,
      "accuracy": 0,
      "masteryLevel": "none",
      "lastPracticed": null
    }
    // ... units 3-115
  ]
}
```

**Mastery Levels:**
- `none` - 0 questions attempted
- `beginner` - < 50% accuracy
- `intermediate` - 50-69% accuracy
- `advanced` - 70-89% accuracy
- `mastered` - ≥ 90% accuracy

**Example:**
```bash
curl http://localhost:3001/api/mastery/123456789
```

#### 3.2 Single Unit Detail

**GET** `/api/mastery/:telegramId/unit/:unitId`

Get detailed mastery data for a specific unit.

**Parameters:**
- `telegramId` (path) - User's Telegram ID
- `unitId` (path) - Unit number (1-115)

**Response:**
```json
{
  "unitId": 5,
  "totalQuestions": 10,
  "correctAnswers": 8,
  "incorrectAnswers": 2,
  "accuracy": 80,
  "attempts": [
    {
      "id": "uuid",
      "questionText": "She ___ to work every day.",
      "questionType": "MULTIPLE_CHOICE",
      "userAnswer": "goes",
      "correctAnswer": "goes",
      "isCorrect": true,
      "attemptDate": "2024-02-13T10:00:00.000Z"
    }
    // ... more attempts
  ]
}
```

**Example:**
```bash
curl http://localhost:3001/api/mastery/123456789/unit/5
```

---

### 4. Error Bank

#### 4.1 Get All Errors

**GET** `/api/error-bank/:telegramId`

Get all incorrectly answered questions for review.

**Parameters:**
- `telegramId` (path) - User's Telegram ID
- `limit` (query, optional) - Number of errors to return (default: 50)
- `offset` (query, optional) - Pagination offset (default: 0)

**Response:**
```json
{
  "total": 25,
  "limit": 50,
  "offset": 0,
  "errors": [
    {
      "id": "uuid",
      "questionId": "uuid",
      "unitId": 5,
      "unitTitle": "Present Simple (he/she/it)",
      "questionText": "My brother ___ to work every day.",
      "questionType": "MULTIPLE_CHOICE",
      "userAnswer": "go",
      "correctAnswer": "goes",
      "explanation": "We use 'goes' with he/she/it...",
      "attemptDate": "2024-02-13T10:00:00.000Z",
      "options": ["go", "goes", "going", "gone"]
    }
    // ... more errors
  ]
}
```

**Example:**
```bash
curl "http://localhost:3001/api/error-bank/123456789?limit=10&offset=0"
```

#### 4.2 Errors by Unit

**GET** `/api/error-bank/:telegramId/by-unit`

Get incorrect attempts grouped by unit.

**Parameters:**
- `telegramId` (path) - User's Telegram ID

**Response:**
```json
{
  "totalErrors": 25,
  "unitsWithErrors": 8,
  "errorsByUnit": [
    {
      "unitId": 12,
      "unitTitle": "Present Continuous vs Present Simple",
      "errorCount": 5
    },
    {
      "unitId": 5,
      "unitTitle": "Present Simple (he/she/it)",
      "errorCount": 3
    }
    // ... sorted by error count descending
  ]
}
```

**Example:**
```bash
curl http://localhost:3001/api/error-bank/123456789/by-unit
```

---

### 5. Quiz Attempts

#### 5.1 Save Quiz Attempt

**POST** `/api/quiz/attempt`

Save a new quiz attempt (alternative to bot's direct save).

**Request Body:**
```json
{
  "telegramId": "123456789",
  "questionId": "uuid",
  "unitId": 5,
  "userAnswer": "goes",
  "isCorrect": true
}
```

**Response:**
```json
{
  "success": true,
  "attemptId": "uuid",
  "attemptDate": "2024-02-13T10:00:00.000Z"
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/quiz/attempt \
  -H "Content-Type: application/json" \
  -d '{
    "telegramId": "123456789",
    "questionId": "abc-123",
    "unitId": 5,
    "userAnswer": "goes",
    "isCorrect": true
  }'
```

#### 5.2 Get Recent Attempts

**GET** `/api/quiz/recent/:telegramId`

Get recent quiz attempts for a user.

**Parameters:**
- `telegramId` (path) - User's Telegram ID
- `limit` (query, optional) - Number of attempts to return (default: 10)

**Response:**
```json
{
  "attempts": [
    {
      "id": "uuid",
      "unitId": 5,
      "unitTitle": "Present Simple (he/she/it)",
      "questionType": "MULTIPLE_CHOICE",
      "question": "She ___ to work every day.",
      "userAnswer": "goes",
      "correctAnswer": "goes",
      "isCorrect": true,
      "attemptDate": "2024-02-13T10:00:00.000Z"
    }
    // ... more attempts
  ]
}
```

**Example:**
```bash
curl "http://localhost:3001/api/quiz/recent/123456789?limit=5"
```

---

## Error Responses

All endpoints return appropriate HTTP status codes:

**400 Bad Request**
```json
{
  "error": "Validation error",
  "details": [...]
}
```

**404 Not Found**
```json
{
  "error": "User not found"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal server error",
  "message": "Error description"
}
```

---

## CORS

CORS is enabled for all origins in development. Update `src/api/server.ts` for production restrictions.

---

## Testing the API

### Using cURL

```bash
# Health check
curl http://localhost:3001/health

# Get user stats
curl http://localhost:3001/api/stats/123456789

# Get mastery data
curl http://localhost:3001/api/mastery/123456789

# Get errors
curl http://localhost:3001/api/error-bank/123456789
```

### Using JavaScript (Fetch)

```javascript
// Get user statistics
const response = await fetch('http://localhost:3001/api/stats/123456789');
const data = await response.json();
console.log(data);
```

---

## Integration with Next.js Dashboard

Example React component:

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function Stats({ telegramId }: { telegramId: string }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:3001/api/stats/${telegramId}`)
      .then(res => res.json())
      .then(data => setStats(data));
  }, [telegramId]);

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <h2>Your Statistics</h2>
      <p>Accuracy: {stats.stats.accuracy}%</p>
      <p>Streak: {stats.stats.dailyStreak} days</p>
    </div>
  );
}
```

---

## Notes

- All date/time fields are in ISO 8601 format
- Telegram IDs are stored as BigInt in the database but returned as strings in JSON
- The API server runs on port 3001 by default (configurable via `API_PORT` env variable)
- The bot also has direct database access, so API endpoints are primarily for dashboard use
