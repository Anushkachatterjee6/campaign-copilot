---
title: Campaign Copilot API
emoji: 🚀
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Campaign Copilot Backend API

Django REST API + WebSocket server for [Campaign Copilot](https://github.com/Anushkachatterjee6/campaign-copilot) — an AI-native CRM.

Auto-deployed from GitHub via GitHub Actions on every push to `master`.

## API

| Endpoint | Description |
|---|---|
| `GET /api/stats/` | Dashboard metrics |
| `GET /api/customers/` | Customer list |
| `GET /api/campaigns/` | Campaign list |
| `GET /api/analytics/charts/` | Analytics data |
| `POST /api/ai/campaign-copilot/` | AI campaign generation |
| `WS /ws/live/` | Live update WebSocket |
