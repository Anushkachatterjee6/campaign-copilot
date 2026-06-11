# Repository Audit: Campaign Copilot AI

This document provides a comprehensive audit of all files in the Campaign Copilot AI codebase. It classifies each file into **Keep**, **Refactor**, or **Delete** and provides a brief rationale for each classification.

---

## File Classification Summary

| Component | Keep | Refactor | Delete | Total |
| :--- | :---: | :---: | :---: | :---: |
| **Root Configuration & Docs** | 18 | 0 | 0 | **18** |
| **Lovable Metadata** | 1 | 0 | 0 | **1** |
| **Django Backend** | 29 | 2 | 0 | **31** |
| **Channel Simulator** | 4 | 0 | 0 | **4** |
| **Frontend Layout & Components** | 53 | 0 | 0 | **53** |
| **Frontend Router & Entry** | 5 | 0 | 0 | **5** |
| **Frontend Libraries & State** | 6 | 1 | 1 | **8** |
| **Frontend Route Screens** | 2 | 8 | 0 | **10** |
| **Total Files** | **118** | **11** | **1** | **130** |

---

## Detailed File Audits

### 1. Root Configuration & Documentation Files
These files provide the configuration of the project tooling, containerization, and architectural documentation.

| File | Status | Lovable Origin | Description / Rationale |
| :--- | :---: | :---: | :--- |
| `.gitignore` | **Keep** | Yes | Ignore files for Git tracking (node_modules, pycache, env, etc.). |
| `.prettierignore` | **Keep** | Yes | Prettier format ignore list. |
| `.prettierrc` | **Keep** | Yes | Prettier format configuration. |
| `ApiSpecification.md` | **Keep** | No | API specification documenting endpoints. |
| `Architecture.md` | **Keep** | No | Architecture design and diagrams. |
| `BackendImplementationPlan.md` | **Keep** | No | Detailed milestones for backend development. |
| `bun.lock` | **Keep** | Yes | Bun lockfile for frontend package dependencies. |
| `bunfig.toml` | **Keep** | Yes | Bun runtime configuration. |
| `components.json` | **Keep** | Yes | Shadcn-UI configuration file. |
| `DatabaseSchema.md` | **Keep** | No | Relational schema definition for PostgreSQL. |
| `DataModelDesign.md` | **Keep** | No | Detailed customer/order data models design. |
| `docker-compose.yml` | **Keep** | No | Multi-container Docker Compose spec (Postgres, CRM, Simulator). |
| `eslint.config.js` | **Keep** | Yes | ESLint styling rules. |
| `FolderStructureProposal.md` | **Keep** | No | Proposals for frontend domain refactoring. |
| `IntegrationPlanWithExistingFrontend.md` | **Keep** | No | Details of route-by-route integration with Django APIs. |
| `package.json` | **Keep** | Yes | Frontend node packages configuration. |
| `tsconfig.json` | **Keep** | Yes | TypeScript compiler rules. |
| `vite.config.ts` | **Keep** | Yes | Vite setup using `@lovable.dev/vite-tanstack-config` plugin. |

---

### 2. Lovable Metadata
Metadata files tracking Lovable code-generation history.

| File | Status | Lovable Origin | Description / Rationale |
| :--- | :---: | :---: | :--- |
| `.lovable/project.json` | **Keep** | Yes | Identifies template `"tanstack_start_ts_2026-06-08"` for Lovable. |

---

### 3. Django Backend (`backend/`)
The Django backend scaffolded code representing the engage CRM core.

| File | Status | Lovable Origin | Description / Rationale |
| :--- | :---: | :---: | :--- |
| `backend/Dockerfile` | **Keep** | No | Builds the Django service container. |
| `backend/manage.py` | **Keep** | No | Standard Django management script. |
| `backend/requirements.txt` | **Keep** | No | Python backend dependencies (Django, DRF, psycopg, openai). |
| `backend/apps/__init__.py` | **Keep** | No | Django applications directory initializer. |
| `backend/apps/crm/__init__.py` | **Keep** | No | CRM application initializer. |
| `backend/apps/crm/admin.py` | **Keep** | No | Register models in Django admin dashboard. |
| `backend/apps/crm/apps.py` | **Keep** | No | CRM application configuration class. |
| `backend/apps/crm/models.py` | **Keep** | No | CRM database models (Customer, Order, Segment, Campaign, etc.). |
| `backend/apps/crm/serializers.py` | **Keep** | No | Model serializers for CRM objects. |
| `backend/apps/crm/api/__init__.py` | **Keep** | No | API package initializer. |
| `backend/apps/crm/api/serializers.py` | **Keep** | No | Input/output serializers for API endpoints (AI & receipts). |
| `backend/apps/crm/api/urls.py` | **Keep** | No | API endpoint routes (AI builder, Copilot, receipts). |
| `backend/apps/crm/api/views.py` | **Keep** | No | API request controllers. |
| `backend/apps/crm/management/__init__.py` | **Keep** | No | Management packages folder setup. |
| `backend/apps/crm/management/commands/__init__.py` | **Keep** | No | Management commands setup. |
| `backend/apps/crm/management/commands/seed_data.py` | **Keep** | No | Database seed script (1000 shoppers, 5000 orders). |
| `backend/apps/crm/migrations/__init__.py` | **Keep** | No | Migrations package initializer. |
| `backend/apps/crm/migrations/0001_initial.py` | **Keep** | No | Initial CRM tables generation migration. |
| `backend/apps/crm/migrations/0002_add_read_communication_event.py` | **Keep** | No | Migration adding 'read' status choices to communications. |
| `backend/apps/crm/prompts/__init__.py` | **Keep** | No | Prompt templates folder initializer. |
| `backend/apps/crm/prompts/audience_builder.py` | **Keep** | No | Prompt definition for natural language audience parsing. |
| `backend/apps/crm/prompts/campaign_copilot.py` | **Keep** | No | Prompt definition for generating campaign copy and metrics. |
| `backend/apps/crm/services/__init__.py` | **Keep** | No | Domain services package initializer. |
| `backend/apps/crm/services/audience_builder.py` | **Refactor** | No | **Broken OpenAI API usage:** Calls `client.responses.create` and references `gpt-4.1-mini` which do not exist in OpenAI. |
| `backend/apps/crm/services/campaign_copilot.py` | **Refactor** | No | **Broken OpenAI API usage:** Calls `client.responses.create` and references `gpt-4.1-mini` which do not exist in OpenAI. |
| `backend/config/__init__.py` | **Keep** | No | Core configuration package initializer. |
| `backend/config/asgi.py` | **Keep** | No | ASGI server configuration. |
| `backend/config/settings.py` | **Keep** | No | Django configurations, database adapter details. |
| `backend/config/urls.py` | **Keep** | No | Base routing urls mappings. |
| `backend/config/wsgi.py` | **Keep** | No | WSGI web application server configuration. |

---

### 4. Channel Simulator (`channel_simulator/`)
FastAPI application simulating WhatsApp, Email, SMS, and Push deliveries.

| File | Status | Lovable Origin | Description / Rationale |
| :--- | :---: | :---: | :--- |
| `channel_simulator/Dockerfile` | **Keep** | No | Container setup for FastAPI simulator service. |
| `channel_simulator/requirements.txt` | **Keep** | No | FastAPI, httpx, uvicorn, pydantic. |
| `channel_simulator/app/__init__.py` | **Keep** | No | Package initializer. |
| `channel_simulator/app/main.py` | **Keep** | No | Simulator API implementation, event generator, and webhook callbacks. |

---

### 5. Frontend Client (`src/`)

#### 5.1 Components
Standard Shadcn-UI and custom app elements.

| Directory / File | Status | Lovable Origin | Description / Rationale |
| :--- | :---: | :---: | :--- |
| `src/components/ui/` | **Keep** | Yes | Folder containing 49 reusable Shadcn UI components. Maintain as-is. |
| `src/components/app-sidebar.tsx` | **Keep** | Yes | Application sidebar navigation layout component. |
| `src/components/stat-card.tsx` | **Keep** | Yes | Reusable metric/number summary visual widget. |
| `src/components/status-badge.tsx` | **Keep** | Yes | Render badges for campaign and communication states. |
| `src/components/topbar.tsx` | **Keep** | Yes | Page header section component. |

#### 5.2 Hooks, Core Router & Global Entries
Client entry points and system utilities.

| File | Status | Lovable Origin | Description / Rationale |
| :--- | :---: | :---: | :--- |
| `src/hooks/use-mobile.tsx` | **Keep** | Yes | Device size detection hook. |
| `src/router.tsx` | **Keep** | Yes | Instantiates TanStack Router client with SSR context. |
| `src/routeTree.gen.ts` | **Keep** | Yes | Auto-generated route tree map. Do not edit directly. |
| `src/server.ts` | **Keep** | Yes | SSR fetch execution wrapper. |
| `src/start.ts` | **Keep** | Yes | Start instance creation. |
| `src/styles.css` | **Keep** | Yes | Global CSS configuration for Tailwind. |

#### 5.3 Frontend Libraries (`src/lib/`)
Application data and logic layers.

| File | Status | Lovable Origin | Description / Rationale |
| :--- | :---: | :---: | :--- |
| `src/lib/config.server.ts` | **Keep** | Yes | Utility to read server environment variables. |
| `src/lib/error-capture.ts` | **Keep** | Yes | Captures uncaught application errors. |
| `src/lib/error-page.ts` | **Keep** | Yes | Renders fallback HTML screen on server crashes. |
| `src/lib/lovable-error-reporting.ts` | **Keep** | Yes | Dispatches logs to Lovable error aggregator. |
| `src/lib/mock-data.ts` | **Refactor/Delete** | Yes | **Placeholder Data:** Holds mock arrays for charts and lists. Needs to be replaced with queries and ultimately deleted. |
| `src/lib/utils.ts` | **Keep** | Yes | CSS merge classnames utility. |
| `src/lib/api/example.functions.ts` | **Delete** | Yes | **Dead Code:** Simple greeting endpoint created as scaffold example. Not imported or used. |

#### 5.4 Screen Routes (`src/routes/`)
Individual layout files containing page templates.

| File | Status | Lovable Origin | Description / Rationale |
| :--- | :---: | :---: | :--- |
| `src/routes/__root.tsx` | **Keep** | Yes | Core Shell wrapper including Query Provider and Sidebar layout. |
| `src/routes/README.md` | **Keep** | Yes | Overview documentation of directory routing. |
| `src/routes/index.tsx` | **Refactor** | Yes | **Placeholder Screen:** Dashboard charts and counts mapped to `mock-data.ts`. |
| `src/routes/analytics.tsx` | **Refactor** | Yes | **Placeholder Screen:** Analytics stats read from static mockup arrays. |
| `src/routes/audiences.tsx` | **Refactor** | Yes | **Placeholder Screen:** Dynamic preview table and random audience size generator. |
| `src/routes/campaigns.tsx` | **Refactor** | Yes | **Placeholder Screen:** Campaign listing page mapped to static mockup array. |
| `src/routes/campaigns.$id.tsx` | **Refactor** | Yes | **Placeholder Screen:** Campaign details read from loader with static funnel simulation. |
| `src/routes/copilot.tsx` | **Refactor** | Yes | **Placeholder Screen:** Campaign generation page containing client-side timeouts. |
| `src/routes/customers.tsx` | **Refactor** | Yes | **Placeholder Screen:** Customer table displaying static rows without paging. |
| `src/routes/customers.$id.tsx` | **Refactor** | Yes | **Placeholder Screen:** Customer details loader looking up data in mock array. |
| `src/routes/settings.tsx` | **Refactor** | Yes | **Placeholder Screen:** Settings configuration fields using local form state. |
