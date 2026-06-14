# API Specification

## API Style

The first backend can use TanStack Start server functions internally, but the contracts should be designed as resource-oriented HTTP APIs. This keeps the frontend decoupled and leaves room for mobile apps, webhook providers, or external integrations later.

Base path: `/api`

Response envelope:

```json
{
  "data": {},
  "meta": {},
  "errors": []
}
```

Error shape:

```json
{
  "data": null,
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "Invalid audience rule.",
      "field": "conditions.0.value"
    }
  ]
}
```

Common query params:

- `page`, `pageSize`: pagination.
- `sort`: comma-separated field list, prefix with `-` for descending.
- `q`: text search.
- `dateFrom`, `dateTo`: ISO dates.
- `channel`: `email`, `whatsapp`, `sms`, `push`.
- `status`: resource-specific status.

## Customers

Purpose: Power customer list, customer profile, search, segmentation, and engagement timeline.

Models: `Customer`, `CustomerConsent`, `CustomerPreference`, `CustomerMetricSnapshot`.

APIs:

### `GET /api/customers`

Query customers.

Query params: `q`, `city`, `channel`, `minSpend`, `lastPurchaseBefore`, `page`, `pageSize`, `sort`.

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Aarav Mehta",
      "email": "aarav.m@gmail.com",
      "phone": "+919999999999",
      "city": "Mumbai",
      "preferredChannel": "whatsapp",
      "lifetimeSpend": 24820,
      "lastPurchaseAt": "2026-05-28T10:00:00Z",
      "engagementScore": 92
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "total": 24819 }
}
```

### `POST /api/customers`

Create a customer.

### `GET /api/customers/{customerId}`

Return profile, consent, preferences, summary metrics, and latest activity.

### `PATCH /api/customers/{customerId}`

Update profile, preferences, or consent.

### `GET /api/customers/{customerId}/timeline`

Return orders, communications, and engagement events in reverse chronological order.

Tradeoffs:

- Customer list should return denormalized summary fields to avoid heavy UI joins.
- Timeline can be a stitched endpoint instead of exposing raw table complexity.

Future scalability:

- Add cursor pagination for large tenants.
- Add saved customer views and advanced search syntax.

## Orders

Purpose: Feed customer history, segmentation, and conversion analytics.

Models: `Order`, `OrderItem`, `Product`, `OrderAttribution`.

APIs:

### `GET /api/orders`

Query orders by customer, date, status, product, or attributed campaign.

### `POST /api/orders/import`

Import orders from CSV or external integrations with idempotency.

Request:

```json
{
  "source": "csv",
  "idempotencyKey": "orders-import-2026-06-11",
  "orders": []
}
```

### `GET /api/orders/{orderId}`

Return order and items.

### `GET /api/customers/{customerId}/orders`

Return customer purchase history.

Tradeoffs:

- Import endpoint should accept batches, but large imports should be converted into background jobs.
- Full order item data improves future AI recommendations.

Future scalability:

- Add integration-specific endpoints for Shopify, WooCommerce, and data warehouse sync.
- Add webhooks for real-time order-created events.

## Audience Segments

Purpose: Build, preview, save, evaluate, and inspect audiences.

Models: `AudienceSegment`, `SegmentMembership`, `SegmentEvaluationRun`, `SegmentInsight`.

APIs:

### `GET /api/audiences`

List saved segments.

### `POST /api/audiences`

Create segment from validated rule JSON.

Request:

```json
{
  "name": "Dormant Premium Buyers",
  "description": "High-value customers with no recent purchase.",
  "sourceType": "manual",
  "rule": {
    "operator": "and",
    "conditions": [
      { "field": "lifetime_spend", "op": "gt", "value": 10000 },
      { "field": "last_purchase_at", "op": "before_relative_days", "value": 60 }
    ]
  }
}
```

### `POST /api/audiences/preview`

Validate rules and return estimated size, sample customers, and insights.

### `POST /api/audiences/{segmentId}/evaluate`

Materialize current membership snapshot.

### `GET /api/audiences/{segmentId}/members`

Paginated customers in the last evaluated snapshot.

### `GET /api/audiences/{segmentId}/insights`

Return LTV, order count, top city, best channel, and AI summary.

Tradeoffs:

- Preview must cap sample size.
- Saved segments should store the rule and the latest evaluated count.

Future scalability:

- Add segment versioning and membership diffs.
- Add async preview for complex rules.

## Campaigns

Purpose: Manage campaign lifecycle and connect audiences, channels, content, sends, and analytics.

Models: `Campaign`, `CampaignVersion`, `CampaignAudience`, `CampaignMessageVariant`, `CampaignSchedule`.

APIs:

### `GET /api/campaigns`

List campaigns by status, channel, search term, or date.

### `POST /api/campaigns`

Create campaign draft.

Request:

```json
{
  "name": "Win-back: 60-day inactive",
  "objective": "win_back",
  "segmentId": "uuid",
  "channel": "whatsapp",
  "messageVariants": [
    {
      "name": "Default",
      "body": "Hi {{first_name}}, we miss you...",
      "ctaText": "Reorder now",
      "ctaUrl": "https://example.com/reorder"
    }
  ]
}
```

### `GET /api/campaigns/{campaignId}`

Return campaign, selected audience, message variants, schedule, and current metrics.

### `PATCH /api/campaigns/{campaignId}`

Update draft campaign fields.

### `POST /api/campaigns/{campaignId}/launch`

Validate campaign, snapshot audience, create communications, and enqueue sends.

### `POST /api/campaigns/{campaignId}/pause`

Pause queued or scheduled sends.

### `GET /api/campaigns/{campaignId}/analytics`

Return funnel, conversion rate, revenue, and trend data.

Tradeoffs:

- Launch endpoint should enqueue work and return a job ID rather than sending synchronously.
- Only draft and scheduled campaigns should be fully editable.

Future scalability:

- Add campaign approval and content version diffing.
- Add multi-channel campaigns and experiment groups.

## Communications

Purpose: Track each recipient-level message and its delivery state.

Models: `Communication`, `CommunicationContent`, `CommunicationProviderAttempt`.

APIs:

### `GET /api/communications`

Query communications by campaign, customer, channel, status, or date.

### `GET /api/communications/{communicationId}`

Return communication details, rendered content, provider attempts, and events.

### `POST /api/campaigns/{campaignId}/communications/prepare`

Prepare recipient messages without sending. Useful for preview and QA.

### `POST /api/communications/{communicationId}/send`

Send or simulate one communication.

### `POST /api/communications/bulk-send`

Queue a batch of communication IDs.

Tradeoffs:

- The UI should usually use campaign analytics, not load all communications for a campaign.
- Communication content should be immutable once sent.

Future scalability:

- Add cursor pagination and async export.
- Add provider-specific debug views only for privileged users.

## Communication Events

Purpose: Ingest and expose message lifecycle events.

Models: `CommunicationEvent`, `EventIngestionBatch`, `ConversionEvent`, `MetricRollup`.

APIs:

### `POST /api/events/communication`

Internal event ingestion endpoint.

Request:

```json
{
  "communicationId": "uuid",
  "eventType": "opened",
  "occurredAt": "2026-06-11T10:12:00Z",
  "source": "simulator",
  "providerEventId": "sim_evt_123",
  "payload": {}
}
```

### `POST /api/events/provider-webhook/{channel}`

Provider webhook endpoint for email, WhatsApp, SMS, or push adapters.

### `GET /api/communications/{communicationId}/events`

Return event timeline.

### `GET /api/campaigns/{campaignId}/events`

Return paginated campaign event stream.

Tradeoffs:

- Provider webhooks need channel-specific signature validation.
- Event ingestion should be idempotent.

Future scalability:

- Add queue-first ingestion and dead-letter handling.
- Add event replay and rollup repair endpoints.

## AI Audience Builder

Purpose: Interpret marketer language into validated audience criteria.

Models: `AiRun`, `AiArtifact`, `AiSegmentDraft`, `AudienceSegment`.

APIs:

### `POST /api/ai/audience-builder/interpret`

Request:

```json
{
  "prompt": "Customers who spent more than Rs 5000 and have not purchased in 90 days",
  "context": {
    "allowedFields": ["lifetime_spend", "last_purchase_at", "city", "preferred_channel"]
  }
}
```

Response:

```json
{
  "data": {
    "runId": "uuid",
    "suggestedName": "Dormant High Spenders",
    "rule": {
      "operator": "and",
      "conditions": [
        { "field": "lifetime_spend", "op": "gt", "value": 5000 },
        { "field": "last_purchase_at", "op": "before_relative_days", "value": 90 }
      ]
    },
    "explanation": "Targets customers with meaningful prior spend and recent inactivity.",
    "warnings": []
  }
}
```

### `POST /api/ai/audience-builder/preview`

Interpret prompt and return segment preview.

### `POST /api/ai/audience-builder/save`

Save approved draft as an `AudienceSegment`.

Tradeoffs:

- AI output must pass schema validation before preview.
- The API should return warnings when a prompt maps ambiguously to fields.

Future scalability:

- Add conversation state for iterative refinement.
- Add prompt evaluation and regression tests.

## AI Campaign Generator

Purpose: Convert a business prompt into a reviewed campaign draft.

Models: `AiRun`, `CampaignDraft`, `CampaignMessageVariant`, `ChannelRecommendation`.

APIs:

### `POST /api/ai/campaign-generator/generate`

Generate audience recommendation, channel, message, reasoning, and predicted metrics.

### `POST /api/ai/campaign-generator/refine`

Refine a draft with user instruction, such as "make it shorter" or "use SMS instead."

### `POST /api/ai/campaign-generator/create-campaign`

Persist an approved AI draft as a real campaign in `draft` status.

Tradeoffs:

- Full campaign generation should not launch automatically.
- Generated message tokens must be validated against supported personalization fields.

Future scalability:

- Add guardrails by channel, language, consent, promotion rules, and brand voice.
- Add historical campaign retrieval for better recommendations.

## Analytics Dashboard

Purpose: Provide chart-ready data to existing dashboard and analytics routes.

Models: `MetricRollup`, `CampaignMetricSnapshot`, `ChannelMetricSnapshot`, `RevenueAttribution`.

APIs:

### `GET /api/dashboard/summary`

Returns total customers, orders, active campaigns, revenue influenced, and deltas.

### `GET /api/dashboard/recommendations`

Returns AI or rules-based next-best actions.

### `GET /api/analytics/funnel`

Returns sent, delivered, opened, clicked, converted.

### `GET /api/analytics/channel-performance`

Returns engagement and conversion by channel.

### `GET /api/analytics/engagement-trend`

Returns date-bucketed engagement by channel.

### `GET /api/analytics/revenue-attribution`

Returns attributed revenue by channel, campaign, or segment.

### `GET /api/analytics/customer-activity`

Returns active and new customers by date bucket.

Tradeoffs:

- Chart endpoints should return exactly what the UI needs to avoid frontend data shaping.
- Detailed analytics endpoints can come later for drill-downs.

Future scalability:

- Add dimensions and filters consistently across analytics endpoints.
- Add caching and rollup freshness metadata.

## Channel Simulator Service

Purpose: Produce demo and test delivery events through the same event pipeline as real providers.

Models: `ChannelProvider`, `SimulationProfile`, `SimulationRun`, `CommunicationEvent`.

APIs:

### `POST /api/simulator/campaigns/{campaignId}/run`

Start a simulation for a campaign.

Request:

```json
{
  "seed": "demo-1",
  "profile": {
    "deliveredRate": 0.96,
    "openRate": 0.58,
    "clickRate": 0.24,
    "conversionRate": 0.08,
    "failureRate": 0.02
  }
}
```

### `GET /api/simulator/runs/{runId}`

Return simulation status and generated counts.

### `POST /api/simulator/communications/{communicationId}/event`

Manually create a simulated event for QA.

### `PATCH /api/settings/channels/{channel}/simulation-profile`

Update default simulation profile for a channel.

Tradeoffs:

- Simulator events must be labeled as `source = simulator`.
- Seeded runs make screenshots and demos stable.

Future scalability:

- Add webhook replay.
- Add provider adapter conformance tests.

## Settings

Purpose: Configure brand, AI, and channel behavior.

APIs:

- `GET /api/settings/brand`
- `PATCH /api/settings/brand`
- `GET /api/settings/channels`
- `PATCH /api/settings/channels/{channel}`
- `POST /api/settings/channels/{channel}/test`
- `PATCH /api/settings/ai`

Tradeoffs:

- Never return plaintext API keys after save.
- Store secrets encrypted or in a dedicated secret manager.

Future scalability:

- Add per-environment channel credentials.
- Add role-based access for sensitive settings.
