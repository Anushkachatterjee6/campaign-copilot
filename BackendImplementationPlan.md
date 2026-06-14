# Backend Implementation Plan

## Objective

Build a production-ready backend for the existing Campaign Copilot frontend without disrupting the current TanStack Start app. The backend should support customers, orders, audiences, campaigns, communications, events, AI generation, analytics, and channel simulation.

## Phase 0: Foundation

Deliverables:

- Environment config and secret handling.
- Database client and migration tooling.
- Shared error, pagination, and validation helpers.
- Tenant context placeholder.
- Health endpoint.

Key decisions:

- PostgreSQL for transactional data.
- Zod schemas shared by API and UI.
- Server-only files for repositories, AI calls, secrets, and provider credentials.

Tradeoffs:

- A modular monolith is simpler than microservices for the first version.
- Tenant support adds small overhead now but avoids painful migrations later.

## Phase 1: CRM and Commerce Core

Components: Customers, Orders.

Implementation:

1. Create customer, consent, preference, order, order item, and product tables.
2. Add repositories for customer list/detail and order history.
3. Add API endpoints/server functions for:
   - customer list and search,
   - customer detail,
   - customer timeline,
   - customer orders,
   - order import.
4. Seed data equivalent to current mock customers and purchases.
5. Replace direct customer mock imports in customer routes with React Query hooks.

Tradeoffs:

- Start with minimal product fields.
- Use denormalized lifetime spend and last purchase fields for fast UI.

Future scalability:

- Add import jobs and identity resolution.
- Add order rollups for RFM and product affinity.

## Phase 2: Audience Segments

Components: Audience Segments, AI Audience Builder foundation.

Implementation:

1. Create audience segment, evaluation run, membership, and insight tables.
2. Define segment rule schema and allowed fields.
3. Build server-side rule compiler from validated JSON to parameterized SQL.
4. Add preview endpoint returning size, sample customers, and insights.
5. Add save and evaluate endpoints.
6. Replace audience route's random-size mock behavior with preview/evaluate calls.

Tradeoffs:

- Use dynamic SQL generated from a strict schema.
- Snapshot memberships for campaigns to preserve launch reproducibility.

Future scalability:

- Add background evaluation for large audiences.
- Add predictive rules and exclusion segments.

## Phase 3: Campaign Management

Components: Campaigns.

Implementation:

1. Create campaign, campaign version, campaign audience, message variant, and schedule tables.
2. Add campaign list/detail/create/update APIs.
3. Add status transition validation.
4. Add campaign analytics placeholder using live communication/event counts when available.
5. Replace campaign route mock imports with API data.

Tradeoffs:

- Keep one primary channel per campaign in UI and API v1.
- Model variants now to avoid a later migration for A/B testing.

Future scalability:

- Add approval workflows, multi-channel journeys, and experiments.

## Phase 4: Communications and Events

Components: Communications, Communication Events.

Implementation:

1. Create communication, communication content, provider attempt, communication event, and conversion event tables.
2. Implement campaign launch:
   - validate campaign,
   - evaluate or load audience snapshot,
   - create communication rows in batches,
   - enqueue send/simulation jobs,
   - transition campaign to active or scheduled.
3. Implement append-only event ingestion.
4. Update communication current status from events.
5. Add customer communication history and campaign event stream endpoints.

Tradeoffs:

- Use background jobs for launch and send work.
- Store rendered content so customer timelines reflect exactly what was sent.

Future scalability:

- Partition communication and event tables.
- Add retry policy, rate limiting, quiet hours, and provider-specific webhooks.

## Phase 5: Channel Simulator Service

Components: Channel Simulator Service.

Implementation:

1. Define provider interface:
   - `prepare`,
   - `send`,
   - `handleWebhook`,
   - `validateConfig`.
2. Implement simulator provider for email, WhatsApp, SMS, and push.
3. Add simulation profiles by channel.
4. Add deterministic seeded simulation run support.
5. Generate sent, delivered, opened, clicked, converted, failed, and bounced events.
6. Feed generated events through the same event ingestion pipeline as real providers.

Tradeoffs:

- Simulator is not a separate path; it exercises real communication/event/analytics logic.
- Simulated events must be clearly flagged.

Future scalability:

- Add real provider adapters for SendGrid, Meta WhatsApp Cloud API, Twilio/Gupshup, and Firebase Cloud Messaging.
- Add webhook replay and provider conformance tests.

## Phase 6: AI Audience Builder

Components: AI Audience Builder.

Implementation:

1. Create AI run and artifact tables.
2. Add prompt templates with versioning.
3. Define allowed segment fields and operators.
4. Implement `interpret` endpoint:
   - build prompt with tenant schema context,
   - request structured JSON output,
   - validate with Zod,
   - persist run and artifact.
5. Implement `preview` endpoint by feeding generated rules into the segment preview service.
6. Implement `save` endpoint to convert approved draft into an audience segment.

Tradeoffs:

- The AI cannot directly execute SQL.
- The explanation is advisory; validated rule JSON is the source of truth.

Future scalability:

- Add feedback capture for accepted/rejected segments.
- Add model evaluations and prompt regression tests.

## Phase 7: AI Campaign Generator

Components: AI Campaign Generator.

Implementation:

1. Add brand profile and AI settings tables.
2. Implement campaign generator prompt using:
   - brand profile,
   - available channels,
   - historical channel performance,
   - allowed personalization tokens,
   - segment summaries.
3. Generate structured draft:
   - campaign name,
   - objective,
   - audience rule or segment reference,
   - channel recommendation,
   - message variants,
   - reasoning,
   - assumptions and warnings.
4. Persist draft as AI artifacts.
5. Add refine endpoint for iterative edits.
6. Add create-campaign endpoint that saves reviewed draft as a normal campaign.
7. Replace Copilot mock result with real AI run and draft data.

Tradeoffs:

- Campaign generation creates drafts only; launch remains explicit.
- Token validation is required before a generated message can be saved.

Future scalability:

- Add multiple variants, experiment design, and generated landing-page links.
- Add retrieval over historical campaign winners.

## Phase 8: Analytics Dashboard

Components: Analytics Dashboard.

Implementation:

1. Add rollup tables for campaign, channel, segment, customer activity, and revenue attribution.
2. Build rollup worker that consumes communication events and orders.
3. Implement dashboard endpoints matching current chart needs.
4. Return rollup freshness metadata.
5. Replace dashboard and analytics route mock imports with React Query hooks.

Tradeoffs:

- Some metrics can be live initially while high-volume funnel metrics become rollups.
- Attribution should start with configurable last-touch rules.

Future scalability:

- Add materialized views.
- Add custom date ranges, cohorts, and drill-down endpoints.

## Phase 9: Settings and Admin

Components: Settings, Channel Providers, Brand Profile, AI Settings.

Implementation:

1. Add brand profile settings.
2. Add encrypted channel credential storage or secret manager integration.
3. Add AI provider configuration.
4. Add channel test endpoint.
5. Gate sensitive settings behind roles.

Tradeoffs:

- Never expose saved secret values back to the browser.
- Use simulator as default provider until real channels are configured.

Future scalability:

- Add per-channel templates, sender identities, compliance profiles, and environments.

## Phase 10: Hardening

Implementation:

- Add authentication and RBAC.
- Add audit log for campaign launch, settings changes, and AI-generated artifacts.
- Add input validation for every endpoint.
- Add rate limiting for AI and channel endpoints.
- Add observability: structured logs, job metrics, rollup freshness, provider failure rates.
- Add tests:
  - schema validation,
  - segment compiler,
  - campaign launch,
  - simulator event generation,
  - analytics rollup,
  - AI output validation fixtures.

## Component Checklist

### Customers

Purpose: Customer profile, contactability, and engagement state.

Models: `Customer`, `CustomerConsent`, `CustomerPreference`, `CustomerMetricSnapshot`.

APIs: list, create, detail, update, timeline, orders, communications.

Tradeoffs: denormalized summary fields improve UI speed but require rollups.

Future scalability: identity resolution, PII encryption, computed traits.

### Orders

Purpose: Purchase history and revenue attribution.

Models: `Order`, `OrderItem`, `Product`, `OrderAttribution`.

APIs: list, import, detail, customer orders, revenue attribution.

Tradeoffs: item-level data increases ingestion work but powers better AI.

Future scalability: real integrations, refunds, subscriptions, warehouse sync.

### Audience Segments

Purpose: Reusable shopper groups.

Models: `AudienceSegment`, `SegmentMembership`, `SegmentEvaluationRun`, `SegmentInsight`.

APIs: list, create, preview, evaluate, members, insights.

Tradeoffs: dynamic segments are fresh; snapshots are reproducible.

Future scalability: compiled query cache, predictive audiences, holdouts.

### Campaigns

Purpose: Lifecycle for campaign planning, launch, and performance.

Models: `Campaign`, `CampaignVersion`, `CampaignAudience`, `CampaignMessageVariant`, `CampaignSchedule`.

APIs: list, create, detail, update, launch, pause, duplicate, analytics.

Tradeoffs: one channel in v1 matches the frontend; variants prepare for tests.

Future scalability: journeys, approval, experiments, budget caps.

### Communications

Purpose: Recipient-level message records.

Models: `Communication`, `CommunicationContent`, `CommunicationProviderAttempt`.

APIs: query, detail, prepare, send, bulk send.

Tradeoffs: per-recipient traceability creates high row counts.

Future scalability: partitions, retries, rate limits, quiet hours.

### Communication Events

Purpose: Append-only delivery and engagement history.

Models: `CommunicationEvent`, `EventIngestionBatch`, `ConversionEvent`, `MetricRollup`.

APIs: ingest, provider webhook, communication events, campaign events, funnel.

Tradeoffs: event auditability requires rollups for fast dashboards.

Future scalability: queue-first ingestion, event replay, partitioning.

### AI Audience Builder

Purpose: Natural-language segment generation.

Models: `AiRun`, `AiArtifact`, `AiSegmentDraft`, `AudienceSegment`.

APIs: interpret, preview, save, run detail.

Tradeoffs: AI output needs strict schema validation.

Future scalability: prompt versioning, evaluations, feedback.

### AI Campaign Generator

Purpose: Prompt-to-campaign draft generation.

Models: `AiRun`, `CampaignDraft`, `CampaignMessageVariant`, `ChannelRecommendation`.

APIs: generate, refine, create campaign, run detail.

Tradeoffs: drafts avoid accidental sends but add one approval step.

Future scalability: multi-variant generation, retrieval, compliance policies.

### Analytics Dashboard

Purpose: Chart-ready engagement, revenue, and customer metrics.

Models: `MetricRollup`, `CampaignMetricSnapshot`, `ChannelMetricSnapshot`, `RevenueAttribution`.

APIs: summary, recommendations, funnel, channel performance, engagement trend, revenue attribution, customer activity.

Tradeoffs: rollups trade freshness for performance.

Future scalability: materialized views, custom dimensions, warehouse export.

### Channel Simulator Service

Purpose: Simulated provider for delivery and engagement events.

Models: `ChannelProvider`, `SimulationProfile`, `SimulationRun`, `CommunicationEvent`.

APIs: run campaign simulation, manual event, run status, update profile.

Tradeoffs: simulation accelerates development but must be clearly labeled.

Future scalability: real provider adapters and webhook replay.
