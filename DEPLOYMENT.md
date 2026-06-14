# Deployment Guide

**All platforms below are completely free and require no credit card or billing verification.**

| Layer | Platform | Cost |
|---|---|---|
| Frontend | Vercel | Free (already deployed) |
| Backend API | HuggingFace Spaces (Docker) | Free, no CC |
| Database | Neon PostgreSQL | Free, no CC |

---

## Step 1 — Create Neon PostgreSQL (5 min)

1. Go to **[neon.tech](https://neon.tech)** → **Sign up with GitHub**
2. Create project: `campaign-copilot`, database name: `campaign_copilot`
3. Copy the **Connection string** (looks like `postgresql://...@...neon.tech/campaign_copilot?sslmode=require`)

---

## Step 2 — Create HuggingFace Space (3 min)

1. Go to **[huggingface.co](https://huggingface.co)** → **Sign up with GitHub**
2. Click your avatar → **New Space**
   - Space name: `campaign-copilot-api`
   - License: MIT
   - **SDK: Docker**
   - Hardware: CPU Basic (free)
   - Visibility: **Public**
3. Click **Create Space** (leave it empty for now — GitHub Actions will push the code)
4. Your Space URL will be: `https://YOUR_HF_USERNAME-campaign-copilot-api.hf.space`

### Get an Access Token

1. HuggingFace → your avatar → **Settings → Access Tokens**
2. **New token** → Name: `github-deploy`, Role: **Write**
3. Copy the token (starts with `hf_...`)

### Set Space environment variables

In your Space → **Settings → Variables and secrets**, add these **secrets**:

| Secret name | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `GEMINI_API_KEY` | Your key from [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `DJANGO_SECRET_KEY` | Any random 50-char string (e.g. from [djecrety.ir](https://djecrety.ir)) |

And these **variables** (non-secret):

| Variable name | Value |
|---|---|
| `DJANGO_DEBUG` | `false` |
| `CORS_ALLOW_ALL` | `true` |

---

## Step 3 — Configure GitHub Actions (2 min)

In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**, add:

| Secret name | Value |
|---|---|
| `HF_TOKEN` | Your HuggingFace access token (`hf_...`) |
| `HF_USERNAME` | Your HuggingFace username |
| `HF_SPACE_NAME` | `campaign-copilot-api` |

---

## Step 4 — Trigger First Deployment

Push any change to trigger the GitHub Action:

```bash
git commit --allow-empty -m "chore: trigger HF deployment"
git push origin master
```

Or go to **GitHub → Actions → Deploy backend to HuggingFace Spaces → Run workflow**.

Watch the deployment at: **huggingface.co/spaces/YOUR_USERNAME/campaign-copilot-api** (Logs tab)

When you see "Build complete" and the space turns green, verify:
```
https://YOUR_USERNAME-campaign-copilot-api.hf.space/api/stats/
```
Should return `{"total_customers": 1000, ...}` ✅

---

## Step 5 — Update Vercel Frontend

In **Vercel → your project → Settings → Environment Variables**:

| Name | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://YOUR_USERNAME-campaign-copilot-api.hf.space` |
| `VITE_WS_BASE_URL` | `wss://YOUR_USERNAME-campaign-copilot-api.hf.space` |

Click **Redeploy** (or push a commit to trigger it automatically).

---

## Subsequent Deploys

Every `git push` to `master`/`main` that touches `backend/` automatically redeploys to HuggingFace via GitHub Actions. No manual steps needed.

---

## Environment Variables Reference

### HuggingFace Space (backend)

| Name | Type | Value |
|---|---|---|
| `DATABASE_URL` | Secret | Neon connection string |
| `GEMINI_API_KEY` | Secret | Gemini API key |
| `DJANGO_SECRET_KEY` | Secret | 50-char random string |
| `DJANGO_DEBUG` | Variable | `false` |
| `CORS_ALLOW_ALL` | Variable | `true` |

### Vercel (frontend)

| Name | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://USERNAME-campaign-copilot-api.hf.space` |
| `VITE_WS_BASE_URL` | `wss://USERNAME-campaign-copilot-api.hf.space` |

---

## Troubleshooting

**Space shows "Building" for >10 min**
→ Check the Logs tab in the HF Space for errors.

**`/api/stats/` returns `{"total_customers": 0}`**
→ In HF Space → **Settings → Factory reset** → retrigger the GitHub Action to re-seed.

**"MODULE NOT FOUND" or import errors in Space logs**
→ `requirements.txt` might be missing a package. Add it and push again.

**AI Copilot returns error**
→ Check that `GEMINI_API_KEY` is set as a **Secret** (not a Variable) in HF Space settings.

**Space sleeps / first request is slow**
→ Free HF Spaces sleep after ~1 hour of inactivity. First request after sleep takes 30-60s. This is normal.

---

## Local Development

Nothing changes for local dev:

```sh
cd backend
python manage.py runserver   # Uses SQLite, port 8000
```

Frontend:
```sh
npm run dev   # Falls back to http://127.0.0.1:8000 when VITE_API_BASE_URL is unset
```

