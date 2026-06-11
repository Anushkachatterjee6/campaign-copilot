// ---------------------------------------------------------------------------
// TypeScript types mirroring the Django backend models & serializers
// ---------------------------------------------------------------------------

export type Channel = "email" | "whatsapp" | "sms" | "push";
export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "completed";
export type CommunicationStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "opened"
  | "read"
  | "clicked"
  | "converted"
  | "failed";
export type EventType = "queued" | "sent" | "delivered" | "opened" | "read" | "clicked" | "converted" | "failed";

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  preferred_channel: Channel;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  customer: number;
  customer_name: string;
  amount: string;
  category: string;
  order_date: string;
  created_at: string;
  updated_at: string;
}

export interface Segment {
  id: number;
  name: string;
  description: string;
  criteria: Record<string, unknown>;
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
  min_total_spend?: number;
  inactive_days?: number;
  cities?: string[];
  categories?: string[];
  preferred_channels?: string[];
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
  criteria: Record<string, unknown>;
  audience_size: number;
  avg_spend: number;
  avg_orders: number;
  top_city: string | null;
  channel_mix: { channel: string; customers: number }[];
}

export interface ExpectedOutcome {
  estimated_reach: number;
  expected_engagement_rate: number;
  expected_conversion_rate: number;
  expected_revenue: number;
  summary: string;
}

export interface CampaignCopilotResponse {
  audience_summary: AudienceSummary;
  reasoning: string;
  recommended_channel: string;
  generated_message: string;
  expected_outcome: ExpectedOutcome;
}

// --- Dashboard stats ---
export interface DashboardStats {
  total_customers: number;
  total_orders: number;
  active_campaigns: number;
  revenue_influenced: number;
  recent_campaigns: Campaign[];
}

// --- API error shape ---
export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
