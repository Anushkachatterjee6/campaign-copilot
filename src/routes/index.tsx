import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import {
  Users,
  ShoppingCart,
  Megaphone,
  IndianRupee,
  Sparkles,
  TrendingUp,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

import { Topbar } from "@/components/topbar";
import { StatCard } from "@/components/stat-card";
import { ChannelBadge, StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatNum } from "@/lib/mock-data";
import { useDashboardStats, useAnalyticsCharts } from "@/hooks/use-api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Campaign Copilot" },
      { name: "description", content: "Customer, campaign, and revenue overview for your AI-native CRM." },
    ],
  }),
  component: Dashboard,
});

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
};

function Dashboard() {
  const { data: liveStats, isError: isStatsError, error: statsError } = useDashboardStats();
  const { data: analytics, isError: isAnalyticsError, error: analyticsError } = useAnalyticsCharts();

  const totalCustomers = liveStats?.total_customers ?? null;
  const totalOrders = liveStats?.total_orders ?? null;
  const activeCampaigns = liveStats?.active_campaigns ?? null;
  const revenueInfluenced = liveStats?.revenue_influenced ?? null;
  const liveCampaigns = liveStats?.recent_campaigns ?? [];
  const topSegments = liveStats?.prebuilt_segments ?? [];
  
  const campaignTrend = analytics?.campaign_trend ?? [];
  const channelPerformance = analytics?.channel_performance ?? [];
  const customerActivity = analytics?.customer_activity ?? [];
  
  const aiRecommendations = [
    { id: 1, title: "Boost WhatsApp Engagement", impact: "High", detail: "WhatsApp campaigns have a 32% higher engagement rate. Focus more on this channel." },
    { id: 2, title: "Optimize Send Times", impact: "Medium", detail: "Best time to send is Tuesday 10-11 AM." }
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar
        title="Dashboard"
        description="Pulse of your customers, campaigns and revenue."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/campaigns">View all campaigns</Link>
          </Button>
        }
      />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        {(isStatsError || isAnalyticsError) && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <p className="font-semibold flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4" />
              API Connection Failed
            </p>
            <p className="opacity-90">
              The dashboard failed to load data from the backend. If you are on Vercel, ensure that <strong>VITE_API_BASE_URL</strong> is correctly set in your environment variables.
            </p>
            <p className="mt-2 text-xs font-mono opacity-70">
              Error details: {(statsError as Error)?.message || (analyticsError as Error)?.message}
            </p>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Customers" value={totalCustomers !== null ? formatNum(totalCustomers) : "…"} delta={4.2} icon={Users} />
          <StatCard label="Total Orders" value={totalOrders !== null ? formatNum(totalOrders) : "…"} delta={6.8} icon={ShoppingCart} />
          <StatCard label="Active Campaigns" value={activeCampaigns !== null ? String(activeCampaigns) : "…"} delta={2.1} icon={Megaphone} />
          <StatCard
            label="Revenue Influenced"
            value={revenueInfluenced !== null ? formatINR(revenueInfluenced) : "…"}
            delta={12.4}
            icon={IndianRupee}
            hint="Attributed to active campaigns"
          />
        </div>

        {/* Charts row */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Campaign Performance Trend</CardTitle>
                  <CardDescription>Sent, opened, and converted over the last 7 days.</CardDescription>
                </div>
                <Badge variant="secondary" className="gap-1"><TrendingUp className="h-3 w-3" /> +18% WoW</Badge>
              </div>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={campaignTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="sent" stroke="hsl(217, 91%, 60%)" strokeWidth={2} fill="url(#g1)" />
                  <Area type="monotone" dataKey="opened" stroke="hsl(160, 84%, 39%)" strokeWidth={2} fill="url(#g2)" />
                  <Line type="monotone" dataKey="converted" stroke="hsl(280, 80%, 60%)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Channel Performance</CardTitle>
              <CardDescription>Engagement vs. conversion by channel.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelPerformance} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="channel" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="engagement" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="conversion" fill="hsl(280, 80%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Customer Activity Trend</CardTitle>
              <CardDescription>Active vs. new customers, last 7 months.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={customerActivity} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="active" stroke="hsl(217, 91%, 60%)" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="new" stroke="hsl(160, 84%, 39%)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* AI Recommendations */}
          <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <CardTitle>AI Recommendations</CardTitle>
              </div>
              <CardDescription>Suggested next best actions for this week.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiRecommendations.map((r) => (
                <div key={r.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{r.title}</p>
                    <Badge variant={r.impact === "High" ? "default" : "secondary"} className="text-[10px]">
                      {r.impact}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{r.detail}</p>
                  <Button size="sm" variant="ghost" className="-ml-2 mt-2 h-7 gap-1 text-xs text-primary" asChild>
                    <Link to="/copilot">Run with Copilot <ArrowRight className="h-3 w-3" /></Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Campaigns</CardTitle>
                  <CardDescription>Latest activity across all channels.</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/campaigns">See all <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <div className="divide-y">
                {liveCampaigns.map((c) => {
                  // Handle both live Campaign objects and mock recentCampaigns
                  const id = typeof c.id === "number" ? c.id : c.id;
                  const channel = (c as {channel?: string}).channel || "email";
                  const status = (c as {status?: string}).status || "draft";
                  const channelDisplay = channel.charAt(0).toUpperCase() + channel.slice(1);
                  const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1);
                  const perf = (c as {perf?: number}).perf;
                  return (
                    <div key={id} className="flex items-center gap-4 px-6 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <ChannelBadge channel={channelDisplay as "Email" | "WhatsApp" | "SMS" | "Push"} />
                          <StatusBadge status={statusDisplay as "Draft" | "Scheduled" | "Active" | "Completed" | "Paused"} />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {perf ? `${(perf * 100).toFixed(1)}%` : "—"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">conversion</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Performing Segments</CardTitle>
              <CardDescription>Highest engagement this quarter.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {topSegments.map((s: any) => (
                <div key={s.id || s.name} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{formatNum(s.customer_count || s.size)} customers</p>
                  </div>
                  <span
                    className={`text-xs font-medium tabular-nums text-emerald-600 dark:text-emerald-400`}
                  >
                    +5%
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
