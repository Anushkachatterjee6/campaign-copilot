# Technical Debt Register: Campaign Copilot AI

This document logs architectural gaps, issues, and bugs discovered during the repository audit. It covers both the frontend client and the Django backend codebases.

---

## 1. Broken AI Service Integrations (Critical Bug)

The backend AI orchestration services in `apps.crm.services` contain invalid and broken references to the OpenAI API:

*   **Invalid OpenAI SDK Methods:**
    *   In [audience_builder.py](file:///c:/Users/Anushka/Downloads/campaign-copilot-main/campaign-copilot-main/backend/apps/crm/services/audience_builder.py#L91) and [campaign_copilot.py](file:///c:/Users/Anushka/Downloads/campaign-copilot-main/campaign-copilot-main/backend/apps/crm/services/campaign_copilot.py#L196), the code makes a call to `client.responses.create(...)`.
    *   **Debt:** The standard OpenAI SDK client does not have a `responses` property. The correct SDK methods are `client.chat.completions.create` or the Beta structured parser `client.beta.chat.completions.parse`.
*   **Non-existent Model Name:**
    *   Both files default the OpenAI model name to `gpt-4.1-mini` (see [audience_builder.py:L88](file:///c:/Users/Anushka/Downloads/campaign-copilot-main/campaign-copilot-main/backend/apps/crm/services/audience_builder.py#L88)).
    *   **Debt:** `gpt-4.1-mini` is not a valid OpenAI model. This should be refactored to use standard models like `gpt-4o-mini` or `gpt-4o` and read from environment variables.

---

## 2. Missing CRUD Backend Endpoints (Major Architecture Gap)

The Django backend defines all the core models and database schema but does not expose them:

*   **Missing API Views:**
    *   The Django REST routing file [urls.py](file:///c:/Users/Anushka/Downloads/campaign-copilot-main/campaign-copilot-main/backend/apps/crm/api/urls.py) only maps routes for the AI services and simulator webhook callbacks.
    *   **Debt:** Standard CRM endpoints (such as `GET /api/customers`, `GET /api/campaigns`, `POST /api/campaigns`, `GET /api/analytics/...`) do not exist. We need to implement ViewSets and link them to routes so that the frontend can fetch and mutation data.

---

## 3. Absence of Multi-Tenancy (Data Design Gap)

The architectural documentation states: *"Design every table with tenant ownership from day one, even if the first version has one workspace"* (see `Architecture.md`).

*   **Missing Models:**
    *   There is no `Tenant` or `Workspace` model defined in [models.py](file:///c:/Users/Anushka/Downloads/campaign-copilot-main/campaign-copilot-main/backend/apps/crm/models.py).
    *   **Debt:** None of the core models (Customer, Order, Segment, Campaign, etc.) have foreign keys linking them to a tenant. If multi-tenancy is required, this will require schema updates and migrations.

---

## 4. Frontend-Backend Data Integration Gaps

The Campaign Copilot AI frontend contains beautiful screen layouts that are completely isolated:

*   **Mock Database Import:**
    *   All route screens under `src/routes/` read data directly from the static file `src/lib/mock-data.ts`.
    *   **Debt:** The front-end contains no API call implementations (no axios/fetch, no TanStack Server Functions) that communicate with the Django application. We need to write React Query hooks to fetch data from the REST backend.
*   **Hardcoded Computations:**
    *   Several screens contain mock calculations (e.g. random audience size in `src/routes/audiences.tsx` and hardcoded conversion funnels in `src/routes/campaigns.$id.tsx`). These should represent real aggregations calculated from Postgres database records.

---

## 5. Dead Code

*   **Unused Server Functions:**
    *   The file `src/lib/api/example.functions.ts` exposes a `getGreeting` server function.
    *   **Debt:** This file is a scaffold template and is not imported or called anywhere in the active frontend. It should be deleted to prevent bundle bloat.

---

## 6. Local Development Networking Asymmetry

*   **Hardcoded Hostnames in Docker:**
    *   The simulator is configured to callback to `http://crm:8000/api/communications/receipts/`. While this works when containers are run inside the Docker bridge network, it breaks if running services locally (e.g. running `python manage.py runserver` on local port 8000).
    *   **Debt:** The simulator's callback URL needs to support configuration via an environment variable that falls back to `localhost` when run locally.
