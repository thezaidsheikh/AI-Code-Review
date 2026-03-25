# 🤖 AI Code Review

> An automated, AI-powered GitHub Pull Request reviewer built as a **GitHub App**. It listens to PR webhook events, analyzes changed code using a configurable LLM (Google Gemini, OpenAI, OpenRouter, or Ollama), and posts structured review comments — with an `APPROVE` or `REQUEST_CHANGES` decision — directly back to the pull request.

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🗂️ Folder Structure](#️-folder-structure)
- [🛠️ Tech Stack](#️-tech-stack)
- [⚙️ Prerequisites](#️-prerequisites)
- [🚀 Getting Started](#-getting-started)
  - [1. Create a GitHub App](#1-create-a-github-app)
  - [2. Clone & Install](#2-clone--install)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
  - [4. Run the Server](#4-run-the-server)
  - [5. Expose the Server (Local Dev)](#5-expose-the-server-local-dev)
- [🌐 API Endpoints](#-api-endpoints)
- [🤖 LLM Providers](#-llm-providers)
- [📐 Review Rubric & Scoring](#-review-rubric--scoring)
- [🔒 Security & Permissions](#-security--permissions)
- [🧩 How It Works — Step by Step](#-how-it-works--step-by-step)
- [📝 Environment Variable Reference](#-environment-variable-reference)
- [🤝 Contributing](#-contributing)

---

## ✨ Features

- 🔔 **Webhook-driven** — triggers automatically on `opened`, `synchronize`, and `reopened` PR events
- 🧠 **Multi-LLM support** — plug in Google Gemini, OpenAI, OpenRouter, or a local Ollama model
- 📂 **Context-aware reviews** — fetches full file context around every changed line, not just the raw diff
- 📊 **Rubric-based scoring** — uses a SonarQube-inspired quality rubric with `BLOCKER`, `MAJOR`, and `MINOR` severity levels
- ✅ / ❌ **Automated decisions** — posts an `APPROVE` or `REQUEST_CHANGES` review directly on the PR
- 🔴 **Commit status checks** — sets a commit status (`ai-pr-review`) so failing reviews block merges
- 🏷️ **Structured comments** — every inline comment follows a consistent template with `rule_id`, `why`, `evidence`, `how_to_fix`, and `confidence`

---

## 🏗️ Architecture

```
                    ┌─────────────────────────────────────────┐
                    │             GitHub Repository            │
                    │                                          │
                    │  Developer opens / updates a PR  ──────►│
                    └──────────────┬──────────────────────────┘
                                   │  Webhook (POST /webhook)
                                   ▼
                    ┌─────────────────────────────────────────┐
                    │          Express.js Server               │
                    │  app.js  →  /webhook  endpoint           │
                    └──────────────┬──────────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────────┐
                    │      Webhook Controller                   │
                    │  controller/webhook.controller.js         │
                    │                                          │
                    │  1. Validate PR action                   │
                    │  2. Authenticate as GitHub App           │
                    │  3. Fetch changed files via GitHub API   │
                    │  4. Build review units (diff + context)  │
                    └──────────────┬──────────────────────────┘
                                   │
                         ┌─────────┴──────────┐
                         │                    │
                         ▼                    ▼
           ┌─────────────────────┐  ┌─────────────────────┐
           │   helper/diff.js    │  │   helper/files.js   │
           │  Parse diff patch   │  │  Fetch full file    │
           │  → changed lines    │  │  content from GitHub│
           └─────────────────────┘  └─────────────────────┘
                         │                    │
                         └─────────┬──────────┘
                                   │  Review Units (file + line + context)
                                   ▼
                    ┌─────────────────────────────────────────┐
                    │          helper/llm.js                   │
                    │                                          │
                    │  Sends:                                  │
                    │   • System prompt (prompts/review.md)    │
                    │   • Rubric        (prompts/rubric.md)    │
                    │   • Comment tmpl  (prompts/comment-      │
                    │                   template.md)           │
                    │   • Review units (JSON payload)          │
                    │                                          │
                    │  Supports: Google │ OpenAI │ OpenRouter  │
                    │            │ Ollama                      │
                    └──────────────┬──────────────────────────┘
                                   │  JSON { decision, comments[] }
                                   ▼
                    ┌─────────────────────────────────────────┐
                    │          GitHub API (Octokit)            │
                    │                                          │
                    │  • POST commit status  (ai-pr-review)   │
                    │  • POST pull_request review              │
                    │    with inline comments                  │
                    └─────────────────────────────────────────┘
```

---

## 🗂️ Folder Structure

```
AI-Code-Review/
│
├── app.js                          # 🚀 Entry point — Express server setup & webhook route
├── routes.js                       # 🛣️  Additional router (extensible)
├── package.json                    # 📦 Dependencies & scripts
│
├── controller/
│   └── webhook.controller.js       # 🎮 Core PR event handler — orchestrates the full review flow
│
├── helper/
│   ├── diff.js                     # 🔍 Parses unified diff patches → extracts changed line numbers
│   ├── files.js                    # 📄 Fetches full file content from GitHub at PR head SHA
│   └── llm.js                      # 🤖 Multi-provider LLM client (Google, OpenAI, OpenRouter, Ollama)
│
├── utils/
│   └── octakit.js                  # 🔐 GitHub App authentication + PR file fetching + review unit assembly
│
└── prompts/
    ├── review.md                   # 📋 LLM system prompt — instructs the model how to review
    ├── rubric.md                   # 📏 SonarQube-like quality rubric (BLOCKER / MAJOR / MINOR rules)
    └── comment-template.md         # 💬 Structured comment format for every inline finding
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | [Node.js](https://nodejs.org/) | JavaScript runtime |
| **Web Framework** | [Express.js v5](https://expressjs.com/) | HTTP server & webhook endpoint |
| **Package Manager** | [pnpm](https://pnpm.io/) | Fast, disk-efficient package manager |
| **GitHub Integration** | [@octokit/rest](https://github.com/octokit/rest.js) | GitHub REST API client |
| **GitHub App Auth** | [@octokit/auth-app](https://github.com/octokit/auth-app.js) | GitHub App JWT + installation token auth |
| **Diff Parsing** | [parse-diff](https://www.npmjs.com/package/parse-diff) | Parse unified diff patches |
| **Base64 Decoding** | [base-64](https://www.npmjs.com/package/base-64) | Decode GitHub API file content |
| **File Matching** | [minimatch](https://www.npmjs.com/package/minimatch) | Glob-based file path filtering |
| **Config** | [dotenv](https://www.npmjs.com/package/dotenv) | Load environment variables from `.env` |
| **AI / LLM** | Google Gemini / OpenAI / OpenRouter / Ollama | Code review intelligence |

---

## ⚙️ Prerequisites

- **Node.js** ≥ 18 (for native `fetch` support)
- **pnpm** ≥ 10 — install with `npm install -g pnpm`
- A **GitHub App** with the permissions listed below
- An API key for at least one supported LLM provider

---

## 🚀 Getting Started

### 1. Create a GitHub App

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**
2. Set the following:
   - **Homepage URL**: your server URL (or `http://localhost:3002` for local dev)
   - **Webhook URL**: `https://<your-public-url>/webhook`
   - **Webhook secret**: optional (leave blank or add HMAC verification)
3. Grant these **Repository Permissions**:
   | Permission | Access |
   |---|---|
   | Pull requests | Read & Write |
   | Contents | Read |
   | Commit statuses | Read & Write |
4. Subscribe to the **Pull request** event
5. After creation, note down the **App ID**, **Client ID**, and **Client Secret**
6. Generate a **Private Key** (`.pem` file) and save it in the project root

---

### 2. Clone & Install

```bash
# Clone the repository
git clone https://github.com/thezaidsheikh/AI-Code-Review.git
cd AI-Code-Review

# Install dependencies
pnpm install
```

---

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
# ── Server ────────────────────────────────────────────
PORT=3002

# ── GitHub App ────────────────────────────────────────
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=./github-app.pem   # path to your downloaded .pem file
APP_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
APP_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── LLM Configuration ─────────────────────────────────
LLM_PROVIDER=google          # google | openai | openrouter | ollama
MODEL=gemini-2.5-flash        # model name for the chosen provider
MAX_TOKENS=2500
TEMPERATURE=0.2

# ── Provider API Keys (only the one you use) ──────────
AI_API_KEY=your_google_ai_api_key          # for LLM_PROVIDER=google
OPENAI_API_KEY=your_openai_api_key         # for LLM_PROVIDER=openai
OPENROUTER_API_KEY=your_openrouter_api_key # for LLM_PROVIDER=openrouter

# ── Optional: Custom base URLs ────────────────────────
# BASE_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
# OLLAMA_BASE_URL=http://localhost:11434
```

> ⚠️ **Never commit `.env` or `github-app.pem` to version control.** Both are already listed in `.gitignore`.

---

### 4. Run the Server

```bash
# Start the server
pnpm start
# or
node app.js
```

You should see:
```
Server running at http://localhost:3002/
```

Verify it's healthy:
```bash
curl http://localhost:3002/check-health
# → Server is up 🆙 and running 🏃
```

---

### 5. Expose the Server (Local Dev)

GitHub needs to reach your local server to send webhooks. Use a tunneling tool:

```bash
# Using ngrok
ngrok http 3002
```

Copy the generated `https://` URL and set it as the **Webhook URL** in your GitHub App settings.

---

## 🌐 API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/check-health` | Health check — returns `200 OK` with a status message |
| `POST` | `/webhook` | GitHub webhook receiver — handles `pull_request` events |

---

## 🤖 LLM Providers

Configure `LLM_PROVIDER` in your `.env` to switch providers:

| Provider | `LLM_PROVIDER` value | Required env var | Default model |
|---|---|---|---|
| 🔵 Google Gemini | `google` | `AI_API_KEY` | `gemini-2.5-flash` |
| 🟢 OpenAI | `openai` | `OPENAI_API_KEY` | any OpenAI model |
| 🟠 OpenRouter | `openrouter` | `OPENROUTER_API_KEY` | any OpenRouter model |
| 🟣 Ollama (local) | `ollama` | _(none — runs locally)_ | any Ollama model |

Set the `MODEL` env var to the exact model string expected by your provider (e.g. `gpt-4o`, `claude-3-5-sonnet`, `llama3`).

---

## 📐 Review Rubric & Scoring

The AI reviewer applies a **SonarQube-inspired rubric** (`prompts/rubric.md`) with 5 categories and 3 severity levels:

### Severity Levels

| Level | Meaning | PR Decision Impact |
|---|---|---|
| 🔴 **BLOCKER** | Must fix before merge — security, correctness, or reliability risk | Always `REQUEST_CHANGES` |
| 🟡 **MAJOR** | Important issue — usually blocks merge | `REQUEST_CHANGES` if ≥ 2 MAJOR issues |
| 🔵 **MINOR** | Suggestion only — does not block approval | `APPROVE` with suggestion |

### Review Categories

| # | Category | Example Rules |
|---|---|---|
| 1 | ✅ **Correctness & Reliability** | Null safety, error handling, input validation, edge cases |
| 2 | 🔒 **Security** | Secrets exposure, injection vectors, broken auth, path traversal |
| 3 | ⚡ **Performance & Scalability** | N+1 queries, blocking I/O, unbounded operations |
| 4 | 🔄 **Concurrency & Async Safety** | Missing `await`, unhandled promises, resource lifecycle |
| 5 | 🧹 **Code Health** | Dead code, excessive complexity, missing tests, naming clarity |

### Decision Policy

```
Any BLOCKER found          → REQUEST_CHANGES
≥ 2 MAJOR issues found     → REQUEST_CHANGES
< 2 MAJOR, no BLOCKERs     → APPROVE  (MINORs posted as suggestions)
```

---

## 🔒 Security & Permissions

- **Authentication** uses GitHub App installation tokens (short-lived, scoped per installation) via `@octokit/auth-app` — no personal access tokens needed.
- The private key (`.pem`) is read from the filesystem path specified in `GITHUB_APP_PRIVATE_KEY` and is never logged or committed.
- Only `opened`, `synchronize`, and `reopened` PR actions are processed; all other events return `200` immediately.

---

## 🧩 How It Works — Step by Step

```
1. 🔔  GitHub sends a POST /webhook event when a PR is opened or updated

2. 🔐  Server authenticates as the GitHub App using the installation ID
        from the webhook payload → gets a short-lived installation token

3. 📂  Fetches the list of changed files in the PR via the GitHub API

4. 🔍  For each file with a diff:
        a. Parses the unified diff patch → extracts added/changed line numbers
        b. Fetches the full file content at the PR head SHA
        c. Builds "review units": { file, line, changed_line, surrounding_context }

5. 🤖  Sends review units to the LLM together with:
        • System prompt  → tells the model its role and output format
        • Rubric         → quality gates and severity rules
        • Comment template → structured format for each finding

6. 📊  LLM returns JSON:
        {
          "decision": "APPROVE | REQUEST_CHANGES",
          "comments": [{ path, line, severity, comment }, ...]
        }

7. 🚦  Sets a GitHub commit status (ai-pr-review):
        • success  → APPROVE
        • failure  → REQUEST_CHANGES

8. 💬  Posts an official GitHub PR review with:
        • The APPROVE / REQUEST_CHANGES decision
        • Inline comments at exact file + line positions
```

---

## 📝 Environment Variable Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3002` | HTTP port the server listens on |
| `GITHUB_APP_ID` | ✅ Yes | — | Numeric ID of your GitHub App |
| `GITHUB_APP_PRIVATE_KEY` | ✅ Yes | — | Path to the `.pem` private key file |
| `APP_CLIENT_ID` | ✅ Yes | — | GitHub App OAuth Client ID |
| `APP_CLIENT_SECRET` | ✅ Yes | — | GitHub App OAuth Client Secret |
| `LLM_PROVIDER` | No | `google` | LLM provider: `google`, `openai`, `openrouter`, `ollama` |
| `MODEL` | No | `gemini-2.5-flash` | Model name for the chosen provider |
| `MAX_TOKENS` | No | `2500` | Max tokens in the LLM response |
| `TEMPERATURE` | No | `0.2` | LLM sampling temperature (lower = more deterministic) |
| `AI_API_KEY` | Conditional | — | Google Gemini API key (required for `google` provider) |
| `BASE_URL` | No | Google API default | Custom endpoint URL for Google Gemini |
| `OPENAI_API_KEY` | Conditional | — | OpenAI API key (required for `openai` provider) |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | Custom OpenAI-compatible base URL |
| `OPENROUTER_API_KEY` | Conditional | — | OpenRouter API key (required for `openrouter` provider) |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | Custom OpenRouter base URL |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama server URL (required for `ollama` provider) |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push the branch: `git push origin feature/your-feature`
5. Open a Pull Request — the bot will review it automatically! 🤖

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/thezaidsheikh">Zaid Qureshi</a>
</p>
