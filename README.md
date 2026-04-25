# Uteo — Backend API

**Your Dream Job Finds You.**

Uteo is an AI-powered, feed-based recruitment platform that connects job seekers and employers through intelligent, personalized job discovery. Unlike traditional job boards where candidates search for roles, Uteo surfaces the right opportunities to the right people at the right time.

## What Uteo Does

- **AI-Powered Feed** — Personalized job recommendations scored by skills overlap, location match, and job recency
- **One-Click Apply** — Streamlined application flow with cover letter and resume URL
- **Real-Time Matching** — Background scoring engine updates feeds as new jobs are posted
- **Employer Tools** — Recruiters post jobs, manage applications, and track candidates through a full hiring pipeline
- **Smart Notifications** — Applicants are notified in-app on every status change
- **Profile Intelligence** — Rich job seeker profiles with work experience, education, and skills drive better matches

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 10 (TypeScript) |
| ORM | Prisma 5 |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| Auth | JWT (access + refresh tokens) |
| File Storage | AWS S3 |
| Email | SendGrid |
| SMS | Africa's Talking |

## Architecture

```
src/
├── common/           # Guards, interceptors, decorators, pagination
├── modules/
│   ├── auth/         # JWT auth, refresh tokens, OTP
│   ├── users/        # User management
│   ├── companies/    # Employer company profiles + recruiter management
│   ├── jobs/         # Job listings CRUD + skills tagging
│   ├── feed/         # AI scoring engine — personalized job feeds
│   ├── applications/ # Application pipeline with status updates
│   ├── profile/      # Job seeker profiles, experience, education
│   ├── notifications/# In-app + push notifications
│   └── skills/       # Skills taxonomy
└── main.ts
```

## API Response Envelope

All endpoints return:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-04-25T10:00:00.000Z"
}
```

## Feed Scoring Algorithm

Each job in a user's feed receives a match score (0–100):

| Factor | Max Points |
|---|---|
| Skills overlap | 50 |
| Location match | 20 |
| Posted within 7 days | 10 |
| Other signals | 20 |

Jobs the user has applied to or skipped are excluded. Up to 500 candidate jobs are scored and paginated.

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL + Redis)
- Prisma CLI

### Setup

```bash
# Install dependencies
npm install

# Start database and cache
docker compose up -d

# Apply migrations
npx prisma migrate dev

# Seed initial data
npx prisma db seed

# Start development server
npm run start:dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
DATABASE_URL=postgresql://uteo:uteo123@localhost:5452/uteo_db
REDIS_HOST=localhost
REDIS_PORT=6352
JWT_ACCESS_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
AWS_BUCKET_NAME=your-bucket
SENDGRID_API_KEY=your-key
```

## Key Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register (job seeker or recruiter) |
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/feed` | Personalized job feed |
| GET | `/api/v1/jobs` | Browse all jobs with filters |
| POST | `/api/v1/jobs` | Create a job (recruiters) |
| POST | `/api/v1/applications` | Apply to a job |
| GET | `/api/v1/applications` | My applications |
| PATCH | `/api/v1/applications/:id/status` | Update application status (recruiters) |
| GET | `/api/v1/profile` | My job seeker profile |
| PUT | `/api/v1/profile` | Update profile |
| GET | `/api/v1/companies` | Browse companies |
| POST | `/api/v1/companies` | Create company (recruiters) |

## License

Private — © 2026 Uteo
