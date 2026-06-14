// ---------------------------------------------------------------------------
// Typed API endpoint functions — one function per REST resource action
// ---------------------------------------------------------------------------

import { api } from "./client";
import { unwrapList } from "./unwrap";
import type {
  AudienceBuilderRequest,
  AudienceBuilderResponse,
  Campaign,
  CampaignCopilotRequest,
  CampaignCopilotResponse,
  Communication,
  Customer,
  DashboardStats,
  AnalyticsCharts,
  Order,
  PaginatedList,
  Segment,
} from "./types";

// ---------------------------------------------------------------------------
// Dashboard & Analytics
// ---------------------------------------------------------------------------
export const fetchDashboardStats = () => api.get<DashboardStats>("/stats/");
export const fetchAnalyticsCharts = () => api.get<AnalyticsCharts>("/analytics/charts/");

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export const fetchCustomers = async (params?: {
  search?: string;
  ordering?: string;
  page?: number;
}) => unwrapList(await api.get<Customer[] | PaginatedList<Customer>>("/customers/", params));

export const fetchCustomer = (id: number) => api.get<Customer>(`/customers/${id}/`);

export const createCustomer = (data: Omit<Customer, "id" | "created_at" | "updated_at">) =>
  api.post<Customer>("/customers/", data);

export const updateCustomer = (id: number, data: Partial<Customer>) =>
  api.patch<Customer>(`/customers/${id}/`, data);

export const deleteCustomer = (id: number) => api.delete(`/customers/${id}/`);

export const fetchCustomerOrders = (id: number) => api.get<Order[]>(`/customers/${id}/orders/`);

export const fetchCustomerCommunications = (id: number) =>
  api.get<Communication[]>(`/customers/${id}/communications/`);

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export const fetchOrders = async (params?: { search?: string; ordering?: string; page?: number }) =>
  unwrapList(await api.get<Order[] | PaginatedList<Order>>("/orders/", params));

export const fetchOrder = (id: number) => api.get<Order>(`/orders/${id}/`);

export const createOrder = (
  data: Omit<Order, "id" | "customer_name" | "created_at" | "updated_at">,
) => api.post<Order>("/orders/", data);

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------
export const fetchSegments = async (params?: {
  search?: string;
  ordering?: string;
  page?: number;
}) => unwrapList(await api.get<Segment[] | PaginatedList<Segment>>("/segments/", params));

export const fetchSegment = (id: number) => api.get<Segment>(`/segments/${id}/`);

export const createSegment = (
  data: Omit<Segment, "id" | "customer_count" | "created_at" | "updated_at">,
) => api.post<Segment>("/segments/", data);

export const updateSegment = (id: number, data: Partial<Segment>) =>
  api.patch<Segment>(`/segments/${id}/`, data);

export const deleteSegment = (id: number) => api.delete(`/segments/${id}/`);

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------
export const fetchCampaigns = async (params?: {
  search?: string;
  ordering?: string;
  page?: number;
  status?: string;
}) => unwrapList(await api.get<Campaign[] | PaginatedList<Campaign>>("/campaigns/", params));

export const fetchCampaign = (id: number) => api.get<Campaign>(`/campaigns/${id}/`);

export const createCampaign = (
  data: Omit<Campaign, "id" | "segment_name" | "created_at" | "updated_at">,
) => api.post<Campaign>("/campaigns/", data);

export const updateCampaign = (id: number, data: Partial<Campaign>) =>
  api.patch<Campaign>(`/campaigns/${id}/`, data);

export const deleteCampaign = (id: number) => api.delete(`/campaigns/${id}/`);

export const launchCampaign = (id: number) => api.post<Campaign>(`/campaigns/${id}/launch/`, {});

export const fetchCampaignCommunications = (id: number) =>
  api.get<Communication[]>(`/campaigns/${id}/communications/`);

export const fetchCampaignStats = (id: number) =>
  api.get<{ campaign_id: number; total_communications: number; by_status: Record<string, number> }>(
    `/campaigns/${id}/stats/`,
  );

// ---------------------------------------------------------------------------
// Communications
// ---------------------------------------------------------------------------
export const fetchCommunications = (params?: {
  search?: string;
  ordering?: string;
  page?: number;
}) => api.get<PaginatedList<Communication>>("/communications/", params);

export const fetchCommunication = (id: number) => api.get<Communication>(`/communications/${id}/`);

// ---------------------------------------------------------------------------
// AI Services
// ---------------------------------------------------------------------------
export const runAudienceBuilder = (data: AudienceBuilderRequest) =>
  api.post<AudienceBuilderResponse>("/ai/audience-builder/", data);

export const runCampaignCopilot = (data: CampaignCopilotRequest) =>
  api.post<CampaignCopilotResponse>("/ai/campaign-copilot/", data);
