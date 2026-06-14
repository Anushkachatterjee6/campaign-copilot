import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";
import { Send, MailOpen, MousePointerClick, CheckCircle2, Inbox, Sparkles } from "lucide-react";

import { Topbar } from "@/components/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { formatINR, formatNum } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { useAnalyticsCharts } from "@/hooks/use-api";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Campaign Copilot" },
      { name: "description", content: "Track deliverability, engagement and revenue across channels." },
    ],
  }),
  component: Analytics,
});

const COLORS = ["hsl(217 91% 60%)", "hsl(160 84% 39%)", "hsl(38 92% 50%)", "hsl(280 80% 60%)"];

function Analytics() {
  const { data: analytics, isLoading } = useAnalyticsCharts();
  
  const funnel = analytics?.funnel ?? [
    { stage: "Sent", value: 0 },
    { stage: "Delivered", value: 0 },
    { stage: "Opened", value: 0 },
    { stage: "Clicked", value: 0 },
    { stage: "Converted", value: 0 },
  ];
  
  const analyticsCards = {
    sent: funnel[0].value,
    delivered: funnel[1].value,
    opened: funnel[2].value,
    clicked: funnel[3].value,
    converted: funnel[4].value,
  };
  
  const engagementTrend = analytics?.engagement_trend ?? [];
  const revenueAttribution = analytics?.revenue_attribution ?? [];
  
  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading...</div>;
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar title="Analytics" description="Full-funnel performance across every channel." />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Sent" value={formatNum(analyticsCards.sent)} delta={5.4} icon={Send} />
          <StatCard label="Delivered" value={formatNum(analyticsCards.delivered)} delta={4.9} icon={Inbox} />
          <StatCard label="Opened" value={formatNum(analyticsCards.opened)} delta={8.2} icon={MailOpen} />
          <StatCard label="Clicked" value={formatNum(analyticsCards.clicked)} delta={12.6} icon={MousePointerClick} />
          <StatCard label="Converted" value={formatNum(analyticsCards.converted)} delta={18.4} icon={CheckCircle2} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Conversion funnel</CardTitle>
              <CardDescription>End-to-end drop-off across campaigns this month.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Funnel dataKey="value" data={funnel} isAnimationActive>
                    {funnel.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                    <LabelList position="right" dataKey="stage" stroke="none" fill="var(--foreground)" fontSize={12} />
                    <LabelList position="center" dataKey="value" stroke="none" fill="#fff" fontSize={12} formatter={(v: number) => formatNum(v)} />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">AI Insights</CardTitle>
              </div>
              <CardDescription>What the model is seeing right now.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Insight tone="positive" text="WhatsApp campaigns generated 32% higher engagement than email this month." />
              <Insight tone="warning" text="SMS conversion has dropped 8% — consider reducing send frequency." />
              <Insight tone="positive" text="Personalized subject lines lift open rate by 21% on email." />
              <Insight tone="info" text="Best time to send: Tuesday 10–11 AM for Bangalore segment." />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Channel comparison</CardTitle>
              <CardDescription>Engagement across channels by week.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagementTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="whatsapp" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="email" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sms" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="push" fill={COLORS[3]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Engagement trend</CardTitle>
              <CardDescription>Weekly open-rate across channels.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={engagementTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="whatsapp" stroke={COLORS[1]} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="email" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="sms" stroke={COLORS[2]} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="push" stroke={COLORS[3]} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Revenue attribution by channel</CardTitle>
            <CardDescription>How much revenue each channel influenced this month.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[260px_1fr]">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={revenueAttribution} dataKey="revenue" nameKey="channel" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {revenueAttribution.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatINR(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {revenueAttribution.map((r: any, i: number) => (
                <div key={r.channel} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-medium">{r.channel}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatINR(r.revenue)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Insight({ tone, text }: { tone: "positive" | "warning" | "info"; text: string }) {
  const map = {
    positive: "border-emerald-500/20 bg-emerald-500/5",
    warning: "border-amber-500/20 bg-amber-500/5",
    info: "border-blue-500/20 bg-blue-500/5",
  } as const;
  const label = { positive: "Insight", warning: "Watch", info: "Tip" } as const;
  return (
    <div className={`rounded-lg border p-3 ${map[tone]}`}>
      <Badge variant="outline" className="mb-1.5 text-[10px]">{label[tone]}</Badge>
      <p className="text-xs leading-relaxed text-foreground">{text}</p>
    </div>
  );
}
