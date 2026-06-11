# Database Schema

## Database Choice

Use PostgreSQL. It fits the app's needs: relational CRM data, JSONB for flexible rules and provider payloads, strong indexes, transactional campaign launch preparation, and materialized views or rollup tables for analytics.

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
```

## Enums

```sql
CREATE TYPE channel AS ENUM ('email', 'whatsapp', 'sms', 'push');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'completed', 'archived');
CREATE TYPE communication_status AS ENUM ('pending', 'queued', 'sent', 'delivered', 'opened', 'clicked', 'converted', 'failed', 'bounced', 'unsubscribed', 'cancelled');
CREATE TYPE communication_event_type AS ENUM ('prepared', 'queued', 'sent', 'delivered', 'opened', 'clicked', 'converted', 'failed', 'bounced', 'unsubscribed', 'simulated');
CREATE TYPE ai_run_type AS ENUM ('audience_builder', 'campaign_generator', 'analytics_insight', 'channel_recommendation');
CREATE TYPE ai_run_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
```

## Core Tables

### Tenants

```sql
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Customers

Purpose: Shopper profile and denormalized CRM summary.

Models: `Customer`, `CustomerIdentity`, `CustomerConsent`, `CustomerPreference`, `CustomerMetricSnapshot`.

APIs: customer list, detail, update, timeline, audience preview.

```sql
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  first_name text,
  last_name text,
  full_name text NOT NULL,
  email citext,
  phone text,
  city text,
  region text,
  country text DEFAULT 'IN',
  preferred_channel channel,
  lifecycle_status text DEFAULT 'active',
  engagement_score integer NOT NULL DEFAULT 0 CHECK (engagement_score BETWEEN 0 AND 100),
  lifetime_spend numeric(12,2) NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  last_purchase_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX customers_tenant_name_idx ON customers (tenant_id, full_name);
CREATE INDEX customers_tenant_email_idx ON customers (tenant_id, email);
CREATE INDEX customers_tenant_city_idx ON customers (tenant_id, city);
CREATE INDEX customers_tenant_spend_idx ON customers (tenant_id, lifetime_spend DESC);
CREATE INDEX customers_tenant_last_purchase_idx ON customers (tenant_id, last_purchase_at);
```

```sql
CREATE TABLE customer_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  provider text NOT NULL,
  external_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);
```

```sql
CREATE TABLE customer_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  channel channel NOT NULL,
  opted_in boolean NOT NULL,
  source text,
  consented_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX customer_consents_customer_channel_idx ON customer_consents (customer_id, channel, consented_at DESC);
```

Tradeoffs:

- Customer summary fields are duplicated from orders/events for fast lists.
- Consent history is append-only instead of a single mutable flag.

Future scalability:

- Encrypt email/phone if compliance requirements increase.
- Add identity merge tables for duplicate profiles.

### Orders

Purpose: Shopper purchase history and revenue attribution.

Models: `Order`, `OrderItem`, `Product`, `OrderAttribution`.

APIs: order import, customer order history, revenue attribution.

```sql
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  sku text,
  title text NOT NULL,
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  price numeric(12,2),
  currency char(3) NOT NULL DEFAULT 'INR',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku)
);
```

```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  external_id text,
  order_number text,
  status text NOT NULL DEFAULT 'paid',
  currency char(3) NOT NULL DEFAULT 'INR',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_total numeric(12,2) NOT NULL DEFAULT 0,
  tax_total numeric(12,2) NOT NULL DEFAULT 0,
  shipping_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL,
  placed_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_id)
);

CREATE INDEX orders_customer_placed_idx ON orders (customer_id, placed_at DESC);
CREATE INDEX orders_tenant_placed_idx ON orders (tenant_id, placed_at DESC);
```

```sql
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  product_id uuid REFERENCES products(id),
  sku text,
  product_title text NOT NULL,
  category text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL,
  total numeric(12,2) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'
);
```

Tradeoffs:

- `order_items` snapshot product title and price to preserve history.
- `products` can remain lightweight until catalog features are needed.

Future scalability:

- Add subscriptions, refunds, returns, and fulfillment tables.
- Add import batch tracking.

### Audience Segments

Purpose: Store audience rules, evaluation runs, and membership snapshots.

Models: `AudienceSegment`, `SegmentMembership`, `SegmentEvaluationRun`, `SegmentInsight`.

APIs: list, create, preview, evaluate, members, insights.

```sql
CREATE TABLE audience_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  description text,
  source_type text NOT NULL DEFAULT 'manual',
  rule jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active',
  estimated_size integer NOT NULL DEFAULT 0,
  last_evaluated_at timestamptz,
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX audience_segments_tenant_name_idx ON audience_segments (tenant_id, name);
CREATE INDEX audience_segments_rule_gin_idx ON audience_segments USING gin (rule);
```

```sql
CREATE TABLE segment_evaluation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  segment_id uuid NOT NULL REFERENCES audience_segments(id),
  status text NOT NULL DEFAULT 'pending',
  matched_count integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  rule_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

```sql
CREATE TABLE segment_memberships (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  segment_id uuid NOT NULL REFERENCES audience_segments(id),
  evaluation_run_id uuid NOT NULL REFERENCES segment_evaluation_runs(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  matched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (segment_id, evaluation_run_id, customer_id)
);

CREATE INDEX segment_memberships_customer_idx ON segment_memberships (tenant_id, customer_id);
```

Tradeoffs:

- Memberships are tied to evaluation runs to preserve snapshots.
- Rule JSON needs strict application-level validation.

Future scalability:

- Store compiled SQL hash and query cost.
- Add segment version table when rules need history.

### Campaigns

Purpose: Campaign lifecycle, audience targeting, channel, content, and scheduling.

Models: `Campaign`, `CampaignVersion`, `CampaignAudience`, `CampaignMessageVariant`, `CampaignSchedule`.

APIs: list, create, detail, update, launch, pause, analytics.

```sql
CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  objective text,
  status campaign_status NOT NULL DEFAULT 'draft',
  primary_channel channel NOT NULL,
  segment_id uuid REFERENCES audience_segments(id),
  scheduled_at timestamptz,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  launched_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX campaigns_tenant_status_idx ON campaigns (tenant_id, status);
CREATE INDEX campaigns_tenant_created_idx ON campaigns (tenant_id, created_at DESC);
```

```sql
CREATE TABLE campaign_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  version_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, version_number)
);
```

```sql
CREATE TABLE campaign_message_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  name text NOT NULL DEFAULT 'Default',
  channel channel NOT NULL,
  subject text,
  body text NOT NULL,
  cta_text text,
  cta_url text,
  token_map jsonb NOT NULL DEFAULT '{}',
  weight integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Tradeoffs:

- `campaign_versions.snapshot` avoids complex versioned joins at launch time.
- One primary channel keeps v1 aligned with the current UI.

Future scalability:

- Add journey nodes and experiment assignments.
- Add approval records.

### Communications

Purpose: One recipient-level message and current status.

Models: `Communication`, `CommunicationContent`, `CommunicationProviderAttempt`.

APIs: query, detail, prepare, send, bulk send.

```sql
CREATE TABLE communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  campaign_id uuid REFERENCES campaigns(id),
  campaign_version_id uuid REFERENCES campaign_versions(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  variant_id uuid REFERENCES campaign_message_variants(id),
  channel channel NOT NULL,
  status communication_status NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz,
  queued_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  converted_at timestamptz,
  failed_at timestamptz,
  provider text,
  provider_message_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX communications_campaign_idx ON communications (campaign_id, status);
CREATE INDEX communications_customer_idx ON communications (customer_id, created_at DESC);
CREATE INDEX communications_tenant_channel_status_idx ON communications (tenant_id, channel, status);
```

```sql
CREATE TABLE communication_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  communication_id uuid NOT NULL UNIQUE REFERENCES communications(id),
  subject text,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  personalization jsonb NOT NULL DEFAULT '{}',
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

```sql
CREATE TABLE communication_provider_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  communication_id uuid NOT NULL REFERENCES communications(id),
  provider text NOT NULL,
  attempt_number integer NOT NULL,
  request_payload jsonb NOT NULL DEFAULT '{}',
  response_payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Tradeoffs:

- The `communications` table keeps current status for fast UI reads.
- Event history remains in `communication_events`.

Future scalability:

- Partition by `created_at`.
- Move large provider payloads to cheaper storage with retention policies.

### Communication Events

Purpose: Append-only message lifecycle and engagement events.

Models: `CommunicationEvent`, `EventIngestionBatch`, `ConversionEvent`, `MetricRollup`.

APIs: ingest, webhooks, event timeline, analytics funnel.

```sql
CREATE TABLE communication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  communication_id uuid NOT NULL REFERENCES communications(id),
  campaign_id uuid REFERENCES campaigns(id),
  customer_id uuid REFERENCES customers(id),
  event_type communication_event_type NOT NULL,
  occurred_at timestamptz NOT NULL,
  source text NOT NULL,
  provider_event_id text,
  simulated boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, provider_event_id)
);

CREATE INDEX communication_events_comm_time_idx ON communication_events (communication_id, occurred_at);
CREATE INDEX communication_events_campaign_type_time_idx ON communication_events (campaign_id, event_type, occurred_at);
CREATE INDEX communication_events_tenant_time_idx ON communication_events (tenant_id, occurred_at DESC);
```

```sql
CREATE TABLE conversion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  order_id uuid REFERENCES orders(id),
  communication_id uuid REFERENCES communications(id),
  campaign_id uuid REFERENCES campaigns(id),
  attribution_model text NOT NULL DEFAULT 'last_touch',
  revenue numeric(12,2) NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Tradeoffs:

- Deduplication assumes provider event IDs are stable; simulator should generate them.
- Conversion events can link orders and communications without mutating orders.

Future scalability:

- Partition events monthly.
- Add dead-letter event ingestion table.

### AI

Purpose: Audit AI prompts, outputs, artifacts, and costs.

Models: `AiRun`, `AiArtifact`, `AiSegmentDraft`, `CampaignDraft`.

APIs: AI audience builder, campaign generator, run detail.

```sql
CREATE TABLE ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  run_type ai_run_type NOT NULL,
  status ai_run_status NOT NULL DEFAULT 'pending',
  model text NOT NULL,
  prompt text NOT NULL,
  input_context jsonb NOT NULL DEFAULT '{}',
  output_summary text,
  token_input integer,
  token_output integer,
  cost_cents integer,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

```sql
CREATE TABLE ai_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  ai_run_id uuid NOT NULL REFERENCES ai_runs(id),
  artifact_type text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Tradeoffs:

- Store prompt and structured output for audit, debugging, and model migration.
- Avoid storing unnecessary PII in AI context.

Future scalability:

- Add prompt template versions and evaluation datasets.
- Add human feedback and approval records.

### Analytics

Purpose: Fast dashboard and chart queries.

Models: `MetricRollup`, `CampaignMetricSnapshot`, `ChannelMetricSnapshot`, `RevenueAttribution`.

APIs: dashboard summary, funnel, channel performance, engagement trend, revenue attribution, customer activity.

```sql
CREATE TABLE metric_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  metric_name text NOT NULL,
  grain text NOT NULL,
  bucket_start timestamptz NOT NULL,
  dimensions jsonb NOT NULL DEFAULT '{}',
  value numeric(18,4) NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, metric_name, grain, bucket_start, dimensions)
);

CREATE INDEX metric_rollups_lookup_idx ON metric_rollups (tenant_id, metric_name, grain, bucket_start);
CREATE INDEX metric_rollups_dimensions_gin_idx ON metric_rollups USING gin (dimensions);
```

```sql
CREATE TABLE campaign_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  bucket_start timestamptz NOT NULL,
  sent_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  clicked_count integer NOT NULL DEFAULT 0,
  converted_count integer NOT NULL DEFAULT 0,
  bounced_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  revenue numeric(12,2) NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, bucket_start)
);
```

Tradeoffs:

- Generic rollups support dashboard flexibility.
- Dedicated campaign snapshots make campaign detail simpler and faster.

Future scalability:

- Add materialized views and warehouse export.
- Track metric definitions by version.

### Channel Simulator and Settings

Purpose: Configure channels, brand, AI, and simulation behavior.

Models: `ChannelProvider`, `SimulationProfile`, `SimulationRun`, `BrandProfile`.

APIs: settings, simulator run, channel test.

```sql
CREATE TABLE channel_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  channel channel NOT NULL,
  provider text NOT NULL DEFAULT 'simulator',
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel, provider)
);
```

```sql
CREATE TABLE simulation_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  channel channel NOT NULL,
  name text NOT NULL DEFAULT 'Default',
  delivered_rate numeric(5,4) NOT NULL DEFAULT 0.9600,
  open_rate numeric(5,4) NOT NULL DEFAULT 0.5800,
  click_rate numeric(5,4) NOT NULL DEFAULT 0.2400,
  conversion_rate numeric(5,4) NOT NULL DEFAULT 0.0800,
  failure_rate numeric(5,4) NOT NULL DEFAULT 0.0200,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

```sql
CREATE TABLE simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  campaign_id uuid REFERENCES campaigns(id),
  seed text,
  status text NOT NULL DEFAULT 'pending',
  generated_counts jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

```sql
CREATE TABLE brand_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  brand_name text NOT NULL,
  sender_name text,
  brand_voice text,
  primary_color text,
  default_disclaimer text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);
```

Tradeoffs:

- Channel `config` should not store plaintext secrets unless encrypted at application level.
- Simulator profiles make demos predictable.

Future scalability:

- Move secrets to a secret manager.
- Add provider credential rotation and per-environment config.
