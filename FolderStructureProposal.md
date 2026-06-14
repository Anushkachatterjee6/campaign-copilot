# Folder Structure Proposal

## Current Structure

The current project is mostly frontend-focused:

```text
src/
  components/
    ui/
    app-sidebar.tsx
    stat-card.tsx
    status-badge.tsx
    topbar.tsx
  hooks/
  lib/
    api/
    mock-data.ts
  routes/
    index.tsx
    copilot.tsx
    audiences.tsx
    campaigns.tsx
    campaigns.$id.tsx
    customers.tsx
    customers.$id.tsx
    analytics.tsx
    settings.tsx
  router.tsx
  server.ts
  start.ts
```

## Proposed Structure

Keep the route files thin and move business/data logic into domain modules.

```text
src/
  app/
    providers/
      query-client.ts
    config/
      env.server.ts
      feature-flags.ts

  components/
    layout/
      app-sidebar.tsx
      topbar.tsx
    ui/
    crm/
      customer-table.tsx
      customer-summary-card.tsx
    campaigns/
      campaign-table.tsx
      campaign-message-preview.tsx
    audiences/
      audience-rule-editor.tsx
      audience-preview-table.tsx
    analytics/
      funnel-chart.tsx
      channel-performance-chart.tsx

  domains/
    customers/
      customers.api.ts
      customers.queries.ts
      customers.schemas.ts
      customers.types.ts
      customers.service.server.ts
      customers.repository.server.ts
    orders/
      orders.api.ts
      orders.queries.ts
      orders.schemas.ts
      orders.types.ts
      orders.service.server.ts
      orders.repository.server.ts
    audiences/
      audiences.api.ts
      audiences.queries.ts
      audiences.schemas.ts
      audiences.types.ts
      audiences.service.server.ts
      audiences.repository.server.ts
      segment-rule-compiler.server.ts
    campaigns/
      campaigns.api.ts
      campaigns.queries.ts
      campaigns.schemas.ts
      campaigns.types.ts
      campaigns.service.server.ts
      campaigns.repository.server.ts
    communications/
      communications.api.ts
      communications.schemas.ts
      communications.types.ts
      communications.service.server.ts
      communications.repository.server.ts
    events/
      events.api.ts
      events.schemas.ts
      events.types.ts
      events.service.server.ts
      events.repository.server.ts
    ai/
      ai-runs.repository.server.ts
      audience-builder.service.server.ts
      campaign-generator.service.server.ts
      prompts/
        audience-builder.prompt.ts
        campaign-generator.prompt.ts
    analytics/
      analytics.api.ts
      analytics.queries.ts
      analytics.schemas.ts
      analytics.service.server.ts
      analytics.repository.server.ts
    channels/
      channel.types.ts
      channel-router.server.ts
      simulator/
        simulator.service.server.ts
        simulator.repository.server.ts
      providers/
        email.provider.server.ts
        whatsapp.provider.server.ts
        sms.provider.server.ts
        push.provider.server.ts
    settings/
      settings.api.ts
      settings.schemas.ts
      settings.service.server.ts
      settings.repository.server.ts

  db/
    client.server.ts
    schema/
      tenants.sql
      customers.sql
      orders.sql
      audiences.sql
      campaigns.sql
      communications.sql
      events.sql
      ai.sql
      analytics.sql
      settings.sql
    migrations/
    seeds/

  jobs/
    queue.server.ts
    workers/
      campaign-launch.worker.server.ts
      communication-send.worker.server.ts
      event-rollup.worker.server.ts
      segment-evaluation.worker.server.ts
      simulator.worker.server.ts

  lib/
    errors.ts
    pagination.ts
    result.ts
    time.ts
    utils.ts

  routes/
    __root.tsx
    index.tsx
    copilot.tsx
    audiences.tsx
    campaigns.tsx
    campaigns.$id.tsx
    customers.tsx
    customers.$id.tsx
    analytics.tsx
    settings.tsx

  server.ts
  start.ts
```

## Naming Rules

- `*.types.ts`: shared TypeScript types safe for client and server.
- `*.schemas.ts`: Zod input/output schemas safe for client and server.
- `*.api.ts`: server function or HTTP client wrapper exposed to UI.
- `*.queries.ts`: React Query keys and hooks.
- `*.service.server.ts`: server-only business logic.
- `*.repository.server.ts`: server-only database access.
- `*.worker.server.ts`: server-only background job processors.

## Component Placement

### Customers

Purpose: Keep customer UI reusable across list, detail, audience preview, and future search.

Models: `Customer`, `CustomerConsent`, `CustomerMetricSnapshot`.

APIs: `customers.api.ts` wraps customer list, detail, orders, communications, and timeline endpoints.

Tradeoffs:

- Domain-local UI components reduce route complexity.
- Too much domain nesting can make shared components harder to find, so generic UI remains under `components/ui`.

Future scalability:

- Move customer search, filters, and timeline into reusable components as screens grow.

### Orders

Purpose: Encapsulate order import, customer purchase history, and attribution inputs.

Models: `Order`, `OrderItem`, `Product`, `OrderAttribution`.

APIs: `orders.api.ts` exposes import, order detail, and customer order history.

Tradeoffs:

- Orders may not need a top-level route initially but should still have a domain module.
- Product models can start minimal.

Future scalability:

- Add import adapters and product catalog management without touching customer routes.

### Audience Segments

Purpose: Own rule validation, rule compilation, preview, membership, and AI-generated segment drafts.

Models: `AudienceSegment`, `SegmentRule`, `SegmentMembership`, `SegmentEvaluationRun`.

APIs: `audiences.api.ts` exposes list, preview, save, evaluate, members, and insights.

Tradeoffs:

- Rule compiler lives server-side to avoid exposing query logic and to keep database safety centralized.
- UI schemas should mirror backend validation to provide immediate feedback.

Future scalability:

- Add a segment rule builder component library and predictive audience modules.

### Campaigns

Purpose: Own campaign CRUD, launch workflow, detail view, and campaign analytics.

Models: `Campaign`, `CampaignVersion`, `CampaignAudience`, `CampaignMessageVariant`.

APIs: `campaigns.api.ts` exposes list, detail, create, update, launch, pause, duplicate, and analytics.

Tradeoffs:

- Campaign UI should consume summarized analytics instead of raw events.
- Launch logic belongs in service/worker files, not route components.

Future scalability:

- Add journeys and experiments under the campaign domain without disrupting existing routes.

### Communications

Purpose: Own recipient-level sends and current delivery state.

Models: `Communication`, `CommunicationContent`, `CommunicationProviderAttempt`.

APIs: `communications.api.ts` exposes communication query, detail, prepare, send, and bulk send.

Tradeoffs:

- Communication tables can be high-volume, so UI should use paginated endpoints.
- Provider attempts should stay server-only except in admin/debug views.

Future scalability:

- Add retry and rate-limit modules under this domain.

### Communication Events

Purpose: Own ingestion, deduplication, and event stream access.

Models: `CommunicationEvent`, `EventIngestionBatch`, `ConversionEvent`.

APIs: `events.api.ts` exposes internal event ingestion and timeline reads.

Tradeoffs:

- Event writes should be append-only.
- Rollup jobs should consume events instead of route components computing metrics.

Future scalability:

- Move to a dedicated event stream later while preserving the service interface.

### AI Audience Builder

Purpose: Own prompt interpretation, schema validation, and audience draft artifacts.

Models: `AiRun`, `AiArtifact`, `AiSegmentDraft`.

APIs: `ai/audience-builder.service.server.ts` and API wrapper expose interpret, preview, and save.

Tradeoffs:

- Prompts should live in files for versioning.
- AI-generated JSON must be validated before executing segment preview.

Future scalability:

- Add prompt versions, evaluation fixtures, and feedback loops.

### AI Campaign Generator

Purpose: Own prompt-to-campaign draft flow.

Models: `AiRun`, `CampaignDraft`, `CampaignMessageVariant`, `ChannelRecommendation`.

APIs: `ai/campaign-generator.service.server.ts` exposes generate, refine, and create campaign.

Tradeoffs:

- Keep generated drafts separate from campaigns until approval.
- Share campaign schemas to reduce drift.

Future scalability:

- Add historical retrieval and multi-variant generation.

### Analytics Dashboard

Purpose: Own chart-ready data contracts and metric rollups.

Models: `MetricRollup`, `CampaignMetricSnapshot`, `ChannelMetricSnapshot`.

APIs: `analytics.api.ts` exposes dashboard summary, funnel, channel performance, engagement trend, revenue attribution, and customer activity.

Tradeoffs:

- Returning chart-ready payloads keeps UI clean.
- Generic analytics endpoints can be added after the fixed dashboard is stable.

Future scalability:

- Add cache layers and materialized-view repositories behind the same service interface.

### Channel Simulator Service

Purpose: Own simulated delivery, engagement, conversion, and failure behavior.

Models: `ChannelProvider`, `SimulationProfile`, `SimulationRun`, `CommunicationEvent`.

APIs: `channels/simulator` exposes campaign simulation, communication event simulation, and run status.

Tradeoffs:

- Simulator should use the same provider interface as real channels.
- Simulation profiles should be tenant-configurable.

Future scalability:

- Add provider adapter tests and webhook replay.

## Migration Strategy

1. Add domain types and schemas that match existing `mock-data.ts`.
2. Create API wrappers returning mock-backed data first.
3. Move route data access from `mock-data.ts` into React Query hooks.
4. Add database repositories and swap service implementations from mock-backed to database-backed.
5. Add workers, simulator, and event rollups.
6. Remove direct route imports from `src/lib/mock-data.ts`.
