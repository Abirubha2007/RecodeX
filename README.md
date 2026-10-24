# ReCodeX

**Write. Run. Optimize. Evolve.**

ReCodeX is an AI-powered coding workspace that combines a Monaco-powered playground, secure isolated code execution, deterministic static analysis, Groq AI explanations, and a side-by-side diff verifier — built to verify optimizations before trusting them.

---

## Features

| Feature | Status |
|---------|--------|
| Monaco Editor playground | ✅ |
| Secure code execution (Judge0) | ✅ (requires Judge0 URL) |
| Static analysis (Python AST, C patterns) | ✅ |
| Complexity estimation | ✅ |
| AI explanations & optimization (Groq) | ✅ (requires GROQ_API_KEY) |
| Green Diff – side-by-side verification | ✅ |
| Benchmarking with charts | ✅ |
| Explainable Green Score | ✅ |
| Persistent storage / accounts | ❌ (MVP is stateless) |

---

## Repository Structure

```
ReCodeX/
├── client/           # React + Vite + TypeScript frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/api.ts
│       └── types/api.ts
├── server/           # FastAPI Python backend
│   └── app/
│       ├── api/routes/
│       ├── core/config.py
│       └── services/
├── .env.example      # Environment template
├── Dockerfile        # Multi-stage build
└── render.yaml       # Render deployment
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+

### 1. Clone & configure environment

```bash
git clone <repo-url>
cd ReCodeX
cp .env.example .env
# Edit .env with your keys
```

### 2. Start the backend

```bash
cd server
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Start the frontend

```bash
cd client
npm install --legacy-peer-deps
npm run dev
```

Visit **http://localhost:5173** — the frontend proxies `/api` to `http://localhost:8000`.

---

## Environment Variables

See [`.env.example`](.env.example) for the complete list.

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | For AI features | Get from [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL` | For AI features | Default: `llama-3.3-70b-versatile` |
| `JUDGE0_BASE_URL` | For execution | Self-hosted or compatible Judge0 endpoint |
| `JUDGE0_API_KEY` | Optional | Only if your Judge0 instance requires it |
| `CORS_ORIGINS` | Production | JSON array of allowed frontend origins |

The app starts and remains functional without these keys — missing features are clearly labeled in the UI.

---

## Setting Up Execution (Judge0)

1. [Self-host Judge0](https://github.com/judge0/judge0) or use a compatible hosted service.
2. Set `JUDGE0_BASE_URL` to your endpoint (no trailing slash).
3. Optionally set `JUDGE0_API_KEY` if your instance requires authentication.

Supported languages: Python, C, C++, JavaScript, Java, Go, Rust, TypeScript.

---

## Setting Up AI (Groq)

1. Create a free account at [console.groq.com](https://console.groq.com).
2. Generate an API key.
3. Set `GROQ_API_KEY=gsk_...` in your `.env`.
4. Set `GROQ_MODEL` to your preferred model (default: `llama-3.3-70b-versatile`).

---

## Running Tests

### Backend

```bash
cd server
pip install -r requirements.txt
pytest tests/ -v
```

### Frontend

```bash
cd client
npm test
```

Tests use mocks for all external services. Actual Judge0 and Groq integrations are only tested when credentials and network access are available.

---

## Deployment on Render

1. Push this repository to GitHub.
2. Create a new Blueprint from `render.yaml` in the Render dashboard.
3. Set the secret environment variables (`GROQ_API_KEY`, `JUDGE0_BASE_URL`, `JUDGE0_API_KEY`) in the Render environment settings.
4. Update `CORS_ORIGINS` with your deployed frontend URL.

---

## Security Notes

- Source code is **never executed** inside the FastAPI process. All execution goes through the external Judge0 provider.
- `GROQ_API_KEY` and `JUDGE0_API_KEY` are **never** sent to the browser.
- AI prompts treat code as data, not instructions.
- Input size, output size, and benchmark iterations are bounded server-side.

---

## Known Limitations

- **No authentication or accounts** — this is a stateless MVP.
- **No persistent storage** — analysis results and history are per-session only.
- **Complexity estimation is heuristic** — it cannot determine exact Big-O for all programs.
- **Green Score is indicative** — weights are design choices, not an industry standard.
- **Benchmark variability** — results depend on the execution provider's hardware and scheduling.
- **AI verification** — the AI has not executed or benchmarked any code it suggests; the execution provider has.

---

## License

MIT
