// ---------------------------------------------------------------------------
// React Query hooks for all API resources
// ---------------------------------------------------------------------------

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createCampaign,
  createCustomer,
  deleteCampaign,
  deleteCustomer,
  fetchCampaign,
  fetchCampaignCommunications,
  fetchCampaignStats,
  fetchCampaigns,
  fetchCustomer,
  fetchCustomerCommunications,
  fetchCustomerOrders,
  fetchCustomers,
  fetchDashboardStats,
  fetchSegments,
  launchCampaign,
  runAudienceBuilder,
  runCampaignCopilot,
  updateCampaign,
  updateCustomer,
} from "@/lib/api/endpoints";
import type {
  AudienceBuilderRequest,
  Campaign,
  CampaignCopilotRequest,
  Customer,
} from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Query key factory — keeps cache keys consistent
// ---------------------------------------------------------------------------
export const queryKeys = {
  stats: () => ["stats"] as const,
  customers: (params?: object) => ["customers", params] as const,
  customer: (id: number) => ["customer", id] as const,
  customerOrders: (id: number) => ["customer", id, "orders"] as const,
  customerCommunications: (id: number) => ["customer", id, "communications"] as const,
  campaigns: (params?: object) => ["campaigns", params] as const,
  campaign: (id: number) => ["campaign", id] as const,
  campaignCommunications: (id: number) => ["campaign", id, "communications"] as const,
  campaignStats: (id: number) => ["campaign", id, "stats"] as const,
  segments: (params?: object) => ["segments", params] as const,
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.stats(),
    queryFn: fetchDashboardStats,
    staleTime: 30_000,
  });
}

export function useAnalyticsCharts() {
  return useQuery({
    queryKey: ["analytics-charts"],
    queryFn: () => {
      // Must import the function we just added to endpoints.ts dynamically if not exported above
      return import("@/lib/api/endpoints").then(m => m.fetchAnalyticsCharts());
    },
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export function useCustomers(params?: { search?: string; ordering?: string; page?: number }) {
  return useQuery({
    queryKey: queryKeys.customers(params),
    queryFn: () => fetchCustomers(params),
    staleTime: 30_000,
  });
}

export function useCustomer(id: number) {
  return useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: () => fetchCustomer(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCustomerOrders(id: number) {
  return useQuery({
    queryKey: queryKeys.customerOrders(id),
    queryFn: () => fetchCustomerOrders(id),
    enabled: !!id,
  });
}

export function useCustomerCommunications(id: number) {
  return useQuery({
    queryKey: queryKeys.customerCommunications(id),
    queryFn: () => fetchCustomerCommunications(id),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Customer, "id" | "created_at" | "updated_at">) => createCustomer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer created");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCustomer(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Customer>) => updateCustomer(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.customer(id) });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCustomer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------
export function useCampaigns(params?: { search?: string; ordering?: string; page?: number; status?: string }) {
  return useQuery({
    queryKey: queryKeys.campaigns(params),
    queryFn: () => fetchCampaigns(params),
    staleTime: 30_000,
  });
}

export function useCampaign(id: number) {
  return useQuery({
    queryKey: queryKeys.campaign(id),
    queryFn: () => fetchCampaign(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCampaignCommunications(id: number) {
  return useQuery({
    queryKey: queryKeys.campaignCommunications(id),
    queryFn: () => fetchCampaignCommunications(id),
    enabled: !!id,
  });
}

export function useCampaignStats(id: number) {
  return useQuery({
    queryKey: queryKeys.campaignStats(id),
    queryFn: () => fetchCampaignStats(id),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Campaign, "id" | "segment_name" | "created_at" | "updated_at">) =>
      createCampaign(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Campaign created");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCampaign(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Campaign>) => updateCampaign(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.campaign(id) });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Campaign deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useLaunchCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => launchCampaign(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.campaign(data.id) });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(`"${data.name}" is now live!`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------
export function useSegments(params?: { search?: string; ordering?: string; page?: number }) {
  return useQuery({
    queryKey: queryKeys.segments(params),
    queryFn: () => fetchSegments(params),
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// AI Services
// ---------------------------------------------------------------------------
export function useAudienceBuilder() {
  return useMutation({
    mutationFn: (data: AudienceBuilderRequest) => runAudienceBuilder(data),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCampaignCopilot() {
  return useMutation({
    mutationFn: (data: CampaignCopilotRequest) => runCampaignCopilot(data),
    onError: (err: Error) => toast.error(err.message),
  });
}
