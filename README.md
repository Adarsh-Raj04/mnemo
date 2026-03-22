# OpenRAG Agent (Mnemo)

A full-stack Retrieval-Augmented Generation (RAG) assistant with:

- FastAPI backend for auth, document ingestion, chat, sharing, connectors, prompts, and vector store management
- React + Vite frontend for onboarding, chat, document/library management, and settings
- Pluggable LLM/embedding providers and pluggable vector stores
- PostgreSQL (SQLAlchemy + Alembic) for app metadata and Chroma/other stores for embeddings

---

## Table of Contents

1. [Features](#features)
2. [Project Structure](#project-structure)
3. [Tech Stack](#tech-stack)
4. [Prerequisites](#prerequisites)
5. [Environment Variables](#environment-variables)
6. [Local Development](#local-development)
7. [API Surface](#api-surface)
8. [Vector Store Options](#vector-store-options)
9. [Data Connectors](#data-connectors)
10. [Deployment Notes](#deployment-notes)
11. [Troubleshooting](#troubleshooting)

---

## Features

- **Authentication & accounts**
  - Signup/login with JWT auth
  - Email verification flow
  - Forgot/reset password flow
- **RAG chat**
  - Standard chat endpoint and streaming SSE endpoint (`/chat/stream`)
  - Session history and session title generation
  - Source citation metadata in responses
- **Document ingestion**
  - Upload `.pdf` and `.txt` files
  - Chunking + embedding + storage
  - Document list, chunk inspection, and delete
- **Knowledge sharing**
  - Share KB with other users as `viewer` or `contributor`
- **Provider flexibility**
  - Chat providers: OpenAI, Anthropic, Gemini, Ollama
  - Embedding providers: OpenAI, Gemini, Ollama
- **Vector store flexibility**
  - Chroma (default), PGVector, Pinecone, Azure AI Search
  - Background migration support between stores
- **External data connectors**
  - SQL connector
  - Google Drive connector (OAuth)
- **Prompt customization**
  - Global and source-level system prompts
- **Storage tracking**
  - Usage endpoint with warning/full thresholds (40MB/50MB)

---

## Project Structure

```text
Agent/
├─ backend/
│  ├─ app/
│  │  ├─ routes/            # API routers (auth, chat, docs, settings, ...)
│  │  ├─ core/              # LLM, embeddings, security, connectors, vector stores
│  │  ├─ models.py          # SQLAlchemy models
│  │  ├─ schemas.py         # Pydantic schemas
│  │  ├─ database.py        # DB engine/session
│  │  └─ main.py            # FastAPI app entrypoint
│  ├─ alembic/              # DB migrations
│  ├─ alembic.ini
│  ├─ gunicorn.config.py
│  └─ requirements.txt
├─ frontend/
│  ├─ src/
│  │  ├─ api/               # Axios API clients
│  │  ├─ pages/             # App pages
│  │  ├─ components/        # UI components
│  │  ├─ context/           # Auth/theme contexts
│  │  └─ hooks/             # Custom hooks (incl. SSE stream hook)
│  └─ package.json
└─ README.md
```

---

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, Alembic, Gunicorn/Uvicorn
- **RAG/LLM**: LangChain ecosystem + provider SDKs
- **Frontend**: React 19, Vite, React Router, React Query, TailwindCSS
- **Persistence**: PostgreSQL (app DB), Chroma/other vector DBs

---

## Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- PostgreSQL (or compatible `DATABASE_URL` target)

Optional (as needed):

- SendGrid account (emails)
- OpenAI / Anthropic / Gemini API keys
- Ollama local runtime
- Google Cloud OAuth credentials (for Drive connector)

---

## Environment Variables

Create a `.env` in `backend/` (or at process working directory where backend starts).

### Required

```env
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/openrag
ENCRYPTION_KEY=<fernet-key>
JWT_SECRET_KEY=<long-random-secret>
```

Generate a Fernet key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Strongly recommended / feature-specific

```env
# JWT
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

# Email / links
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=no-reply@yourdomain.com
APP_BASE_URL=http://localhost:5173
BACKEND_URL=http://localhost:8081/mnemo

# Google Drive OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8081/mnemo/connectors/gdrive/callback
```

Frontend variable (`frontend/.env`):

```env
VITE_BACKEND_URL=http://localhost:8081/mnemo
```

---

## Local Development

### 1) Backend setup

From `Agent/backend`:

```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Run migrations:

```bash
alembic upgrade head
```

Start API (dev):

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8081
```

Health check:

```bash
curl http://localhost:8081/mnemo/
```

### 2) Frontend setup

From `Agent/frontend`:

```bash
npm install
npm run dev
```

Default frontend URL: `http://localhost:5173`

### 3) Production-style backend run

From `Agent/backend`:

```bash
gunicorn -c gunicorn.config.py app.main:app
```

Docker (backend):

```bash
docker build -t openrag-backend ./backend
docker run --env-file ./backend/.env -p 8081:8081 openrag-backend
```

---

## API Surface

Base app metadata:

- App title: `Mnemo API`
- Version: `2.0.0`
- Configured root path: `/mnemo`

Primary route groups:

- `/auth` — signup/login/me/change-password/reset flows
- `/chat` — session APIs, `/ask`, `/stream` (SSE)
- `/documents` — upload/list/delete/chunks
- `/settings` — user model/provider/chunk settings, clear KB
- `/sharing` — invite/list/revoke/update permissions
- `/prompts` — global/source-level prompt management
- `/vector-store` — test/configure/migrate/status/reset
- `/connectors` — test/connect/list/sync/delete + SQL preview + Drive OAuth
- `/storage` — usage and quota status

---

## Vector Store Options

Supported store types in backend:

- `chroma` (default)
- `pgvector`
- `pinecone`
- `azure_search`

For non-default stores, configure via `/vector-store/configure` and optionally migrate with `/vector-store/migrate`.

---

## Data Connectors

Supported connector types:

- `sql`
- `google_drive`

Typical workflow:

1. Test connection (`/connectors/test`)
2. Save connection (`/connectors/connect`)
3. Discover sources (tables/files)
4. Sync selected sources (`/connectors/{id}/sync`)

Storage limits enforced during sync:

- Warning threshold: 40MB
- Hard stop: 50MB

---

## Deployment Notes

- `backend/Dockerfile` runs Gunicorn on port `8081`
- Frontend expects backend at `VITE_BACKEND_URL`
- If deployed behind a reverse proxy under `/mnemo`, keep frontend backend URL aligned with that path
- CORS is currently permissive (`*`) in backend; tighten for production

---

## Troubleshooting

- **`DATABASE_URL` missing / DB connection errors**
  - Ensure `DATABASE_URL` is present in backend environment and reachable
- **`ENCRYPTION_KEY` errors**
  - Must be a valid Fernet key string
- **401 loops in frontend**
  - Frontend auto-clears token and redirects to login on 401; re-authenticate and verify backend URL
- **No embeddings/chat output**
  - Confirm provider API keys are saved in Settings
- **Google Drive auth failure**
  - Verify `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and redirect URI match exactly
