# JOHAR

JOHAR is a digital platform for Jharkhand that connects citizens, universities, industries and
government to identify local societal problems, collaborate on solutions, measure real-world
impact and reuse proven solutions in other districts.

## Features

- **Citizen challenge reporting** — report local problems with photos/videos and location
- **AI challenge analysis** (Groq) — category, severity, priority score, skills required
- **Duplicate detection** (AI-assisted) — surfaces similar already-reported problems
- **Community validation** — support / dispute / comment with a community validation score
- **Location-based discovery** — nearby challenges using geospatial queries
- **Local Samvaad** — location-based community discussions (1–25 km radius or district)
- **University collaboration** — AI university matching, interest responses, challenge assignment
- **Industry collaboration** — AI industry matching, collaboration requests, support offers
- **Funding commitments** — recorded intents of sponsorship (no payment processing)
- **Project lifecycle** — proposed → approved → development → pilot → deployed → completed,
  with teams, faculty mentors and auto-progress milestones
- **Social impact** — before/after metrics, beneficiaries, indicative impact score (0–100)
- **Solution library** — deployed/completed projects discoverable as reusable solutions
- **Solution replication** (AI-assisted) — matches proven solutions to open challenges in
  other districts; replication always requires human/institutional approval
- **Government analytics** — dashboard for challenges, districts, universities, industries,
  projects, funding, community participation, impact and replication readiness

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, React Router, Axios, Leaflet |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) with geospatial (2dsphere) indexes |
| AI | Groq API (`GROQ_API_KEY`, backend-only) |
| Media | Cloudinary |

AI features degrade gracefully: if no Groq key is configured, keyword/database fallbacks are used.

## Project Structure

```
johar/
├── frontend/               # React + Vite client
│   └── src/
│       ├── components/     # shared UI (ProtectedRoute, ImpactSection, map…)
│       ├── context/        # AuthContext
│       ├── layouts/        # RootLayout (role-aware nav + footer)
│       ├── pages/          # all screens (challenges, samvaad, solutions, admin…)
│       ├── services/       # axios API clients per module
│       └── utils/          # constants (districts, categories, languages)
└── backend/                # Express API
    └── src/
        ├── config/         # env + MongoDB connection
        ├── controllers/    # request handlers
        ├── middleware/     # auth, role authorization, errors, uploads
        ├── models/         # Mongoose schemas
        ├── routes/         # modular route definitions
        ├── services/       # business logic + Groq integrations
        ├── app.js          # express app (CORS via env)
        └── server.js       # entry point (uses process.env.PORT)
```

## Environment Variables

### Backend (`backend/.env`) — see `backend/.env.example`

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | no | Defaults to `4000` |
| `NODE_ENV` | no | `production` enables strict checks |
| `MONGODB_URI` | yes in production | MongoDB / Atlas connection string |
| `JWT_SECRET` | yes in production | Secret for JWT signing |
| `JWT_EXPIRES_IN` | no | Defaults to `7d` |
| `GROQ_API_KEY` | optional | Enables AI features |
| `GROQ_MODEL` | no | Defaults to `openai/gpt-oss-120b` |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | for uploads | Media storage |
| `CORS_ORIGIN` | no | Comma-separated allowed origins (defaults to `http://localhost:5173`) |

### Frontend (`frontend/.env`) — see `frontend/.env.example`

| Variable | Description |
| --- | --- |
| `VITE_API_BASE_URL` | Backend base URL (e.g. `https://your-api.example.com/api`). Leave empty in dev to use the Vite proxy. |

Never commit `.env` files — they are git-ignored.

## Local Development

```bash
# backend
cd backend
cp .env.example .env      # fill in credentials
npm install
npm run dev               # http://localhost:4000

# frontend (new terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173 (proxies /api → :4000)
```

Health check: `GET http://localhost:4000/api/health`

## Build

```bash
cd frontend && npm run build     # outputs to frontend/dist
cd backend  && npm start         # production server (uses process.env.PORT)
```

## Deployment Overview

- **Frontend** → Vercel / Netlify: build command `npm run build`, output `dist`,
  set `VITE_API_BASE_URL` to the deployed API URL.
- **Backend** → Render / Railway / Fly.io: start command `npm start`
  (listens on `process.env.PORT`), set all backend env vars including `CORS_ORIGIN`
  pointing at the deployed frontend URL.
- **Database** → MongoDB Atlas: create a cluster, allow the backend host's network access,
  set `MONGODB_URI` to the Atlas SRV connection string.

Government/admin accounts are created manually in the database with the
`government` or `admin` role — these roles cannot be self-registered.
