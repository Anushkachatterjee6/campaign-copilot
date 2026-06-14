// ---------------------------------------------------------------------------
// TypeScript types mirroring the Django backend models & serializers
// ---------------------------------------------------------------------------

export type Channel = "email" | "whatsapp" | "sms" | "push";
export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "completed";
export type ChurnRisk = "low" | "medium" | "high";
export type CommunicationStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "opened"
  | "read"
  | "clicked"
  | "converted"
  | "failed";
export type EventType =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "read"
  | "clicked"
  | "converted"
  | "failed";

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  preferred_channel: Channel;
  // RFM intelligence — all monetary values in INR
  clv: string; // Decimal as string from DRF
  rfm_score: number; // 1–5 composite RFM score
  rfm_recency: number; // days since last order
  rfm_frequency: number; // total orders
  rfm_monetary: string; // avg order value in INR (Decimal string)
  churn_risk: ChurnRisk;
  // Health score derived fields
  health_score: number; // 0–100
  health_score_label: "Healthy" | "At Risk" | "High Churn Risk";
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  customer: number;
  customer_name: string;
  amount: string; // INR (primary application field)
  source_amount_brl: string | null; // Original BRL amount (Olist only)
  category: string;
  order_date: string;
  review_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface Segment {
  id: number;
  name: string;
  description: string;
  criteria: Record<string, unknown>;
  is_prebuilt: boolean;
  customers: number[];
  customer_count: number;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: number;
  name: string;
  goal: string;
  channel: Channel;
  status: CampaignStatus;
  audience_size: number;
  segment: number | null;
  segment_name: string | null;
  message: string;
  expected_outcome: ExpectedOutcome | null;
  created_at: string;
  updated_at: string;
}

export interface CommunicationEvent {
  id: number;
  communication: number;
  event_type: EventType;
  timestamp: string;
}

export interface Communication {
  id: number;
  campaign: number;
  campaign_name: string;
  customer: number;
  customer_name: string;
  personalized_message: string;
  status: CommunicationStatus;
  events: CommunicationEvent[];
  created_at: string;
  updated_at: string;
}

// --- Paginated list wrapper (DRF DefaultRouter default) ---
export interface PaginatedList<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// --- AI service types ---
export interface AudienceBuilderRequest {
  input: string;
}

export interface AudienceFilters {
  min_total_spend?: number; // INR threshold
  inactive_days?: number;
  cities?: string[];
  categories?: string[];
  preferred_channels?: string[];
  min_rfm_score?: number; // 1–5
  churn_risk?: ChurnRisk;
}

export interface AudienceBuilderResponse {
  filters: AudienceFilters;
  audience_size: number;
  avg_spend: number;
  top_city: string | null;
}

export interface CampaignCopilotRequest {
  input: string;
}

export interface AudienceSummary {
  name: string;
  prebuilt_segment: string | null; // Name of matched prebuilt segment, if any
  criteria: Record<string, unknown>;
  audience_size: number;
  avg_spend: number; // INR
  avg_orders: number;
  top_city: string | null;
  channel_mix: { channel: string; customers: number }[];
  // RFM intelligence — all INR
  avg_clv_inr: number | null;
  avg_recency_days: number | null;
  avg_frequency: number | null;
  avg_rfm_score: number | null;
  churn_risk_pct: number | null; // % of audience with churn_risk=high
}

export interface ExpectedOutcome {
  estimated_reach: number;
  expected_engagement_rate: number;
  expected_conversion_rate: number;
  expected_revenue: number;
  summary: string;
}

export interface CampaignCopilotResponse {
  campaign_id: number | null;
  audience_summary: AudienceSummary;
  reasoning: string;
  recommended_channel: string;
  generated_message: string;
  expected_outcome: ExpectedOutcome;
}

// --- Dashboard stats ---
export interface SegmentSummary {
  id: number;
  name: string;
  customer_count: number;
}

export interface AnalyticsCharts {
  funnel: { stage: string; value: number }[];
  channel_performance: { channel: string; engagement: number; conversion: number }[];
  customer_activity: { month: string; active: number; new: number }[];
  revenue_trend: { month: string; revenue: number }[];
  revenue_attribution: { channel: string; revenue: number }[];
  engagement_trend: {
    date: string;
    whatsapp: number;
    email: number;
    sms: number;
    push: number;
  }[];
  campaign_trend: { date: string; sent: number; opened: number; converted: number }[];
}

export interface DashboardStats {
  total_customers: number;
  total_orders: number;
  active_campaigns: number;
  revenue_influenced: number; // INR
  revenue_influenced_inr: number; // INR (explicit key)
  recent_campaigns: Campaign[];
  prebuilt_segments: SegmentSummary[];
  rfm_summary: {
    avg_clv_inr: number;
    avg_rfm_score: number;
  };
}

// --- API error shape ---
export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
